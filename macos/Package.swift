// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MonoExpireMac",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "MonoExpire", targets: ["MonoExpireMac"]),
        .library(name: "MonoExpireMacSupport", targets: ["MonoExpireMacSupport"])
    ],
    targets: [
        .target(name: "MonoExpireMacSupport"),
        .executableTarget(name: "MonoExpireMac", dependencies: ["MonoExpireMacSupport"]),
        .testTarget(name: "MonoExpireMacSupportTests", dependencies: ["MonoExpireMacSupport"])
    ]
)
