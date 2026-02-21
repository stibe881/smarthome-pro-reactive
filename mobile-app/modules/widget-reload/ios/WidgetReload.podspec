Pod::Spec.new do |s|
  s.name           = 'WidgetReload'
  s.version        = '1.0.0'
  s.summary        = 'Expo module to reload WidgetKit timelines'
  s.description    = 'Provides a bridge to call WidgetCenter.shared.reloadAllTimelines() from React Native'
  s.homepage       = 'https://github.com/stibe881/smarthome-pro-reactive'
  s.license        = 'MIT'
  s.author         = 'stibe88'
  s.source         = { git: '' }
  s.platform       = :ios, '14.0'
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
end
