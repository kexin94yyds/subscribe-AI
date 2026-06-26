import AppKit
import EventKit
import MonoExpireMacSupport
import WebKit

@MainActor
final class CalendarBridge: NSObject, WKScriptMessageHandler {
    static let messageHandlerName = "monoExpireCalendar"

    static let userScript = WKUserScript(
        source: """
        (() => {
          if (window.monoExpireMacCalendar) return;

          const pending = new Map();

          window.monoExpireMacCalendar = {
            exportEvents(events) {
              return new Promise((resolve, reject) => {
                const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                pending.set(id, { resolve, reject });
                window.webkit.messageHandlers.monoExpireCalendar.postMessage({ id, events });
              });
            },
            __resolve(id, result) {
              const entry = pending.get(id);
              if (!entry) return;
              pending.delete(id);
              entry.resolve(result);
            },
            __reject(id, message) {
              const entry = pending.get(id);
              if (!entry) return;
              pending.delete(id);
              entry.reject(new Error(message));
            }
          };
        })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
    )

    weak var webView: WKWebView?

    private let eventStore = EKEventStore()

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        Task {
            await handle(messageBody: message.body)
        }
    }

    private func handle(messageBody: Any) async {
        do {
            let request = try CalendarExportRequest(messageBody: messageBody)
            let result = try await export(events: request.events)
            resolve(requestID: request.id, result: [
                "addedCount": result.addedCount,
                "skippedCount": result.skippedCount
            ])
        } catch {
            reject(requestID: requestID(from: messageBody), message: error.localizedDescription)
        }
    }

    private func export(events: [CalendarExportEventPayload]) async throws -> ExportResult {
        try await requestCalendarAccess()

        guard let calendar = eventStore.defaultCalendarForNewEvents else {
            throw CalendarBridgeError.noDefaultCalendar
        }

        var result = ExportResult()

        for payload in events {
            let startDate = Date(timeIntervalSince1970: payload.startDate / 1000)
            let endDate = Date(timeIntervalSince1970: payload.endDate / 1000)

            if payload.dedupe && containsDuplicate(
                title: payload.title,
                startDate: startDate,
                endDate: endDate,
                calendar: calendar
            ) {
                result.skippedCount += 1
                continue
            }

            let event = EKEvent(eventStore: eventStore)
            event.calendar = calendar
            event.title = payload.title
            event.startDate = startDate
            event.endDate = endDate
            event.isAllDay = payload.isAllDay
            event.notes = payload.description

            for alertMinutes in payload.alerts {
                event.addAlarm(EKAlarm(relativeOffset: TimeInterval(alertMinutes * 60)))
            }

            try eventStore.save(event, span: .thisEvent, commit: false)
            result.addedCount += 1
        }

        try eventStore.commit()
        openCalendarApp()

        return result
    }

    private func containsDuplicate(title: String, startDate: Date, endDate: Date, calendar: EKCalendar) -> Bool {
        let predicate = eventStore.predicateForEvents(withStart: startDate, end: endDate, calendars: [calendar])
        return eventStore.events(matching: predicate).contains { event in
            event.title == title
        }
    }

    private func requestCalendarAccess() async throws {
        if #available(macOS 14.0, *) {
            let granted: Bool = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
                eventStore.requestFullAccessToEvents { granted, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: granted)
                    }
                }
            }

            guard granted else {
                throw CalendarBridgeError.accessDenied
            }
            return
        }

        let granted: Bool = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
            eventStore.requestAccess(to: .event) { granted, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: granted)
                }
            }
        }

        guard granted else {
            throw CalendarBridgeError.accessDenied
        }
    }

    private func openCalendarApp() {
        guard let calendarURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.iCal") else {
            return
        }

        NSWorkspace.shared.open(calendarURL)
    }

    private func resolve(requestID: String, result: [String: Int]) {
        guard let json = jsonString(result) else {
            reject(
                requestID: requestID,
                message: CalendarBridgeError.invalidResponse.errorDescription ?? "Could not serialize the calendar export response."
            )
            return
        }

        evaluateJavaScript("window.monoExpireMacCalendar && window.monoExpireMacCalendar.__resolve(\(encodedString(requestID)), \(json));")
    }

    private func reject(requestID: String?, message: String) {
        guard let requestID else {
            return
        }

        evaluateJavaScript("window.monoExpireMacCalendar && window.monoExpireMacCalendar.__reject(\(encodedString(requestID)), \(encodedString(message)));")
    }

    private func evaluateJavaScript(_ source: String) {
        webView?.evaluateJavaScript(source)
    }

    private func requestID(from messageBody: Any) -> String? {
        (messageBody as? [String: Any])?["id"] as? String
    }

    private func jsonString(_ value: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value) else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    private func encodedString(_ value: String) -> String {
        guard let data = try? JSONEncoder().encode(value),
              let string = String(data: data, encoding: .utf8) else {
            return "\"\""
        }

        return string
    }
}

private struct ExportResult {
    var addedCount = 0
    var skippedCount = 0
}

private enum CalendarBridgeError: LocalizedError {
    case accessDenied
    case noDefaultCalendar
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Calendar access was denied."
        case .noDefaultCalendar:
            return "No default calendar is available."
        case .invalidResponse:
            return "Could not serialize the calendar export response."
        }
    }
}
