import Foundation
import XCTest
@testable import MonoExpireMacSupport

final class CalendarExportRequestTests: XCTestCase {
    func testDecodesBridgeMessageBody() throws {
        let request = try CalendarExportRequest(messageBody: [
            "id": "request-1",
            "events": [
                [
                    "title": "Gemini 订阅到期",
                    "startDate": 1_788_000_000_000.0,
                    "endDate": 1_788_086_400_000.0,
                    "isAllDay": true,
                    "description": "Annual plan",
                    "alerts": [-4320, -2880, -1440, -60],
                    "dedupe": true
                ]
            ]
        ])

        XCTAssertEqual(request.id, "request-1")
        XCTAssertEqual(request.events.count, 1)
        XCTAssertEqual(request.events[0].title, "Gemini 订阅到期")
        XCTAssertEqual(request.events[0].alerts, [-4320, -2880, -1440, -60])
        XCTAssertTrue(request.events[0].dedupe)
    }

    func testRejectsMessageWithoutRequestID() {
        XCTAssertThrowsError(try CalendarExportRequest(messageBody: ["events": []])) { error in
            XCTAssertEqual(error as? CalendarExportRequestError, .missingRequestID)
        }
    }
}

