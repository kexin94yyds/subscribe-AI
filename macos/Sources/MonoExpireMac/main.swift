import AppKit
import MonoExpireMacSupport
import WebKit

private let appName = "MonoExpire"
private let serverPort: UInt16 = 41731

private enum MonoExpireMacError: Error, LocalizedError {
    case missingWebRoot([String])

    var errorDescription: String? {
        switch self {
        case .missingWebRoot(let checkedPaths):
            return "Could not find bundled web assets. Checked: \(checkedPaths.joined(separator: ", "))"
        }
    }
}

@MainActor
private final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var staticServer: StaticFileServer?
    private var calendarBridge: CalendarBridge?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        staticServer?.stop()
    }

    private func start() {
        Task {
            do {
                let webRoot = try resolveWebRoot()
                let server = try StaticFileServer(webRoot: webRoot, port: serverPort)
                try await server.start()
                staticServer = server
                showMainWindow(url: server.baseURL)
            } catch {
                showErrorWindow(message: error.localizedDescription)
            }
        }
    }

    private func resolveWebRoot() throws -> URL {
        var checkedPaths: [String] = []
        let fileManager = FileManager.default
        let environment = ProcessInfo.processInfo.environment

        if let overridePath = environment["MONOEXPIRE_WEB_ROOT"], !overridePath.isEmpty {
            let overrideURL = URL(fileURLWithPath: overridePath, isDirectory: true)
            checkedPaths.append(overrideURL.path)
            if fileManager.fileExists(atPath: overrideURL.appendingPathComponent("index.html").path) {
                return overrideURL
            }
        }

        if let resourceURL = Bundle.main.resourceURL {
            let bundledURL = resourceURL.appendingPathComponent("dist", isDirectory: true)
            checkedPaths.append(bundledURL.path)
            if fileManager.fileExists(atPath: bundledURL.appendingPathComponent("index.html").path) {
                return bundledURL
            }
        }

        let workingDirectoryURL = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
        let localDistURL = workingDirectoryURL.appendingPathComponent("dist", isDirectory: true)
        checkedPaths.append(localDistURL.path)
        if fileManager.fileExists(atPath: localDistURL.appendingPathComponent("index.html").path) {
            return localDistURL
        }

        throw MonoExpireMacError.missingWebRoot(checkedPaths)
    }

    private func showMainWindow(url: URL) {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let calendarBridge = CalendarBridge()
        configuration.userContentController.addUserScript(CalendarBridge.userScript)
        configuration.userContentController.add(calendarBridge, name: CalendarBridge.messageHandlerName)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        calendarBridge.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1180, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = appName
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)

        self.window = window
        self.calendarBridge = calendarBridge
        NSApp.activate(ignoringOtherApps: true)

        webView.load(URLRequest(url: url))
    }

    private func showErrorWindow(message: String) {
        let label = NSTextField(labelWithString: "MonoExpire could not start.\n\n\(message)")
        label.alignment = .center
        label.lineBreakMode = .byWordWrapping
        label.maximumNumberOfLines = 0

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 640, height: 240),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = appName
        window.center()
        window.contentView = label
        window.makeKeyAndOrderFront(nil)

        self.window = window
        NSApp.activate(ignoringOtherApps: true)
    }
}

@main
private enum MonoExpireMac {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
        _ = delegate
    }
}
