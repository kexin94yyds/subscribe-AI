// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MonoExpireMac",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "MonoExpireMacSupport", targets: ["MonoExpireMacSupport"])
    ],
    targets: [
        .target(name: "MonoExpireMacSupport"),
        .testTarget(name: "MonoExpireMacSupportTests", dependencies: ["MonoExpireMacSupport"])
    ]
)

