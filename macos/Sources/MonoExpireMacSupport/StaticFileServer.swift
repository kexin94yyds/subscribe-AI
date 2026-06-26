import Foundation

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

