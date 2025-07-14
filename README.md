# Timecount

Timecount is an [Obsidian.md](https://obsidian.md) plugin that aims to store and let you view the time spent in the program.

## Features

- **Automatic Time Tracking**: Starts tracking when you open Obsidian and automatically pauses during inactivity
- **Session Management**: Intelligent session handling with configurable timeout periods
- **Real-time Status Bar**: Shows total time spent with today's time in parentheses
- **Detailed Statistics**: View daily, weekly, and all-time statistics
- **Data Export**: Export your time data as JSON for external analysis
- **Configurable Settings**: Customize tracking behavior, notifications, and storage location

## Installation

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/klangkuenstler/obsidian-timecount/releases)
2. Extract the files to your `.obsidian/plugins/obsidian-timecount/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

### Building from Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Copy `main.js`, `manifest.json`, and `styles.css` to your plugins folder

## Usage

1. Enable the plugin in your Community Plugins settings
2. The plugin will automatically start tracking when enabled
3. Check the status bar to see your total time and today's time
4. Click the clock icon in the ribbon to view detailed statistics

The status bar shows your time in the format: `⏰ [All Time] ([Today])`

## Development acknowledgements

1. This plugin is not fully developed yet, therefore there is no warranty that it will work properly;
2. This project is developed for fun only by me, and I don't intend to make it really good, neither user focused. Instead, its only purpose is to expand my own practice development knowledge by developing my first Obsidian plugin.

With this in mind, don't expect much.

## Issues and pull requests

As mentioned in the previous section, this is nothing but a side fun project.
Anyways, **issues and/or pull requests are welcome!**

## License

0BSD License - see [LICENSE](LICENSE) for details.