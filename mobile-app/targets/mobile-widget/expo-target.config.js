module.exports = config => ({
  type: "widget",
  icon: 'https://github.com/expo.png',
  productName: "HomePilot Widget",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.stibe88.mobileapp"]
  },
});