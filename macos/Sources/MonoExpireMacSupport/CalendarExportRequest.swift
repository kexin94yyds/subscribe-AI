import Foundation

public enum CalendarExportRequestError: Error, Equatable {
    case invalidMessageBody
    case missingRequestID
}

public struct CalendarExportEventPayload: Codable, Equatable {
    public let title: String
    public let startDate: Double
    public let endDate: Double
    public let isAllDay: Bool
    public let description: String
    public let alerts: [Int]
    public let dedupe: Bool
}

public struct CalendarExportRequest: Equatable {
    public let id: String
    public let events: [CalendarExportEventPayload]

    private struct Message: Codable {
        let id: String?
        let events: [CalendarExportEventPayload]
    }

    public init(messageBody: Any) throws {
        guard JSONSerialization.isValidJSONObject(messageBody) else {
            throw CalendarExportRequestError.invalidMessageBody
        }

        let data = try JSONSerialization.data(withJSONObject: messageBody)
        let message = try JSONDecoder().decode(Message.self, from: data)

        guard let id = message.id, !id.isEmpty else {
            throw CalendarExportRequestError.missingRequestID
        }

        self.id = id
        self.events = message.events
    }
}

