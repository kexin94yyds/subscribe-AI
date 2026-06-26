import Foundation
import XCTest
@testable import MonoExpireMacSupport

final class StaticFileResponderTests: XCTestCase {
    private var temporaryDirectory: URL!
    private var webRoot: URL!

    override func setUpWithError() throws {
        temporaryDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MonoExpireMacSupportTests-\(UUID().uuidString)", isDirectory: true)
        webRoot = temporaryDirectory.appendingPathComponent("dist", isDirectory: true)
        try FileManager.default.createDirectory(
            at: webRoot.appendingPathComponent("assets", isDirectory: true),
            withIntermediateDirectories: true
        )
        try "<html>MonoExpire</html>".data(using: .utf8)!.write(to: webRoot.appendingPathComponent("index.html"))
        try "console.log('ok');".data(using: .utf8)!.write(to: webRoot.appendingPathComponent("assets/app.js"))
        try "outside".data(using: .utf8)!.write(to: temporaryDirectory.appendingPathComponent("secret.txt"))
    }

    override func tearDownWithError() throws {
        if let temporaryDirectory {
            try? FileManager.default.removeItem(at: temporaryDirectory)
        }
    }

    func testServesAssetWithJavaScriptMimeType() throws {
        let responder = StaticFileResponder(webRoot: webRoot)

        let response = responder.response(forPath: "/assets/app.js", method: "GET")

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertEqual(response.reasonPhrase, "OK")
        XCTAssertEqual(response.headers["Content-Type"], "text/javascript; charset=utf-8")
        XCTAssertEqual(String(data: response.body, encoding: .utf8), "console.log('ok');")
    }

    func testUnknownRouteFallsBackToIndexHtml() throws {
        let responder = StaticFileResponder(webRoot: webRoot)

        let response = responder.response(forPath: "/accounts/123", method: "GET")

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertEqual(response.headers["Content-Type"], "text/html; charset=utf-8")
        XCTAssertEqual(String(data: response.body, encoding: .utf8), "<html>MonoExpire</html>")
    }

    func testPathTraversalIsForbidden() throws {
        let responder = StaticFileResponder(webRoot: webRoot)

        let response = responder.response(forPath: "/../secret.txt", method: "GET")

        XCTAssertEqual(response.statusCode, 403)
        XCTAssertEqual(response.reasonPhrase, "Forbidden")
        XCTAssertFalse(String(data: response.body, encoding: .utf8)?.contains("outside") ?? true)
    }

    func testStaticFileServerRespondsOverHTTP() async throws {
        let server = try StaticFileServer(webRoot: webRoot, port: 0)
        try await server.start()
        defer { server.stop() }

        let url = server.baseURL.appendingPathComponent("assets/app.js")
        let (data, response) = try await URLSession.shared.data(from: url)

        let httpResponse = try XCTUnwrap(response as? HTTPURLResponse)
        XCTAssertEqual(httpResponse.statusCode, 200)
        XCTAssertEqual(httpResponse.value(forHTTPHeaderField: "Content-Type"), "text/javascript; charset=utf-8")
        XCTAssertEqual(String(data: data, encoding: .utf8), "console.log('ok');")
    }
}
