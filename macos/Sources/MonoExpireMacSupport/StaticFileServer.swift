import Foundation
import Network

public struct HTTPResponse: Equatable {
    public let statusCode: Int
    public let reasonPhrase: String
    public let headers: [String: String]
    public let body: Data

    public init(statusCode: Int, reasonPhrase: String, headers: [String: String] = [:], body: Data = Data()) {
        self.statusCode = statusCode
        self.reasonPhrase = reasonPhrase
        self.headers = headers
        self.body = body
    }

    public func serialized() -> Data {
        var responseHeaders = headers
        responseHeaders["Connection"] = "close"

        var headerLines = "HTTP/1.1 \(statusCode) \(reasonPhrase)\r\n"
        for key in responseHeaders.keys.sorted() {
            headerLines += "\(key): \(responseHeaders[key] ?? "")\r\n"
        }
        headerLines += "\r\n"

        var data = Data(headerLines.utf8)
        data.append(body)
        return data
    }
}

public enum StaticFileServerError: Error, Equatable, LocalizedError {
    case invalidPort(UInt16)
    case listenerFailed(String)
    case listenerCancelled

    public var errorDescription: String? {
        switch self {
        case .invalidPort(let port):
            return "Invalid localhost port: \(port)"
        case .listenerFailed(let message):
            return "Static server failed: \(message)"
        case .listenerCancelled:
            return "Static server was cancelled before it was ready"
        }
    }
}

public final class StaticFileServer {
    private let requestedPort: UInt16
    private let responder: StaticFileResponder
    private let queue = DispatchQueue(label: "com.monoexpire.mac.static-server")
    private var listener: NWListener?
    private var activePort: UInt16?

    public init(webRoot: URL, port: UInt16 = 41731) throws {
        self.requestedPort = port
        self.responder = StaticFileResponder(webRoot: webRoot)
    }

    public var baseURL: URL {
        let port = activePort ?? requestedPort
        return URL(string: "http://localhost:\(port)/")!
    }

    public func start() async throws {
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true

        let newListener: NWListener
        if requestedPort == 0 {
            newListener = try NWListener(using: parameters)
        } else if let port = NWEndpoint.Port(rawValue: requestedPort) {
            newListener = try NWListener(using: parameters, on: port)
        } else {
            throw StaticFileServerError.invalidPort(requestedPort)
        }

        listener = newListener
        newListener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var didResume = false
            newListener.stateUpdateHandler = { [weak self] state in
                guard !didResume else { return }

                switch state {
                case .ready:
                    self?.activePort = newListener.port.map { UInt16($0.rawValue) } ?? self?.requestedPort
                    didResume = true
                    continuation.resume()
                case .failed(let error):
                    didResume = true
                    continuation.resume(throwing: StaticFileServerError.listenerFailed(error.localizedDescription))
                case .cancelled:
                    didResume = true
                    continuation.resume(throwing: StaticFileServerError.listenerCancelled)
                default:
                    break
                }
            }
            newListener.start(queue: queue)
        }
    }

    public func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, _, _ in
            let response = self?.response(for: data) ?? Self.badRequestResponse()
            connection.send(content: response.serialized(), completion: .contentProcessed { _ in
                connection.cancel()
            })
        }
    }

    private func response(for data: Data?) -> HTTPResponse {
        guard
            let data,
            let requestText = String(data: data, encoding: .utf8),
            let requestLine = requestText.components(separatedBy: "\r\n").first
        else {
            return Self.badRequestResponse()
        }

        let parts = requestLine.split(separator: " ", maxSplits: 2).map(String.init)
        guard parts.count >= 2 else {
            return Self.badRequestResponse()
        }

        return responder.response(forPath: parts[1], method: parts[0])
    }

    private static func badRequestResponse() -> HTTPResponse {
        let body = Data("Bad Request".utf8)
        return HTTPResponse(
            statusCode: 400,
            reasonPhrase: "Bad Request",
            headers: [
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Length": "\(body.count)"
            ],
            body: body
        )
    }
}

public final class StaticFileResponder {
    private let webRoot: URL
    private let fileManager: FileManager

    public init(webRoot: URL, fileManager: FileManager = .default) {
        self.webRoot = webRoot.standardizedFileURL
        self.fileManager = fileManager
    }

    public func response(forPath path: String, method: String) -> HTTPResponse {
        guard method == "GET" || method == "HEAD" else {
            return textResponse(statusCode: 405, reasonPhrase: "Method Not Allowed", body: "Method Not Allowed")
        }

        switch resolvedFileURL(forPath: path) {
        case .forbidden:
            return textResponse(statusCode: 403, reasonPhrase: "Forbidden", body: "Forbidden")
        case .allowed(let url):
            return fileResponse(for: url, includeBody: method == "GET")
        }
    }

    private enum Resolution {
        case allowed(URL)
        case forbidden
    }

    private func resolvedFileURL(forPath rawPath: String) -> Resolution {
        let pathWithoutQuery = rawPath.split(separator: "?", maxSplits: 1).first.map(String.init) ?? "/"
        let relativePath = pathWithoutQuery.hasPrefix("/")
            ? String(pathWithoutQuery.dropFirst())
            : pathWithoutQuery
        let decodedPath = relativePath.removingPercentEncoding ?? relativePath
        let components = decodedPath.split(separator: "/").map(String.init)

        guard !components.contains("..") else {
            return .forbidden
        }

        let requestedURL = components.reduce(webRoot) { partialURL, component in
            partialURL.appendingPathComponent(component)
        }.standardizedFileURL

        guard isInsideWebRoot(requestedURL) else {
            return .forbidden
        }

        var isDirectory: ObjCBool = false
        if fileManager.fileExists(atPath: requestedURL.path, isDirectory: &isDirectory), !isDirectory.boolValue {
            return .allowed(requestedURL)
        }

        return .allowed(webRoot.appendingPathComponent("index.html"))
    }

    private func isInsideWebRoot(_ url: URL) -> Bool {
        let rootPath = webRoot.path
        let candidatePath = url.path
        return candidatePath == rootPath || candidatePath.hasPrefix(rootPath + "/")
    }

    private func fileResponse(for url: URL, includeBody: Bool) -> HTTPResponse {
        guard let data = try? Data(contentsOf: url) else {
            return textResponse(statusCode: 404, reasonPhrase: "Not Found", body: "Not Found")
        }

        let body = includeBody ? data : Data()
        return HTTPResponse(
            statusCode: 200,
            reasonPhrase: "OK",
            headers: [
                "Content-Type": mimeType(for: url),
                "Content-Length": "\(body.count)"
            ],
            body: body
        )
    }

    private func textResponse(statusCode: Int, reasonPhrase: String, body: String) -> HTTPResponse {
        let data = Data(body.utf8)
        return HTTPResponse(
            statusCode: statusCode,
            reasonPhrase: reasonPhrase,
            headers: [
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Length": "\(data.count)"
            ],
            body: data
        )
    }

    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html":
            return "text/html; charset=utf-8"
        case "js", "mjs":
            return "text/javascript; charset=utf-8"
        case "css":
            return "text/css; charset=utf-8"
        case "json":
            return "application/json; charset=utf-8"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "svg":
            return "image/svg+xml"
        case "ico":
            return "image/x-icon"
        case "txt":
            return "text/plain; charset=utf-8"
        default:
            return "application/octet-stream"
        }
    }
}
