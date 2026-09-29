# Neon District

A low-poly, browser-playable 3D driving game prototype built with Three.js. It is designed to run on laptop and mobile browsers without a build pipeline or downloaded asset pack.

## Run it

Serve this folder over HTTP so the browser can load the ES module:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` on a laptop or phone on the same network. A Replit static deployment can serve the same files directly.

## Controls

### Laptop

- **WASD / Arrow keys:** walk or drive
- **Mouse:** look around while the game canvas has pointer lock
- **E:** enter/exit the nearest vehicle, or interact with the DMV
- **Shift:** handbrake
- **I:** open inventory
- **Fullscreen button:** browser fullscreen

### Mobile

The game detects a coarse pointer and switches to a virtual joystick plus touch controls. Landscape is recommended; fullscreen is available in the upper-right corner.

## Gameplay loop

1. Start outside the DMV near the orange marker.
2. Walk to the DMV entrance and press **E** (or the purple enter button).
3. Follow the six glowing checkpoints in the supplied test vehicle.
4. Finish inside 90 seconds while keeping the speed under 45 KM/H and avoiding three violations.
5. Your `driving_license` is added to the inventory and saved to `localStorage`.
6. Without a licence, attempting to enter a normal car displays: “You need a driving licence to drive this vehicle.”

## Missions, audio and garage

After passing the test, open **Missions** to take one of three delivery or route contracts. Follow the cyan checkpoint marker and minimap target to earn credits. Open **Garage** near the Eastside Garage to repaint the current car or spend credits on engine and handling upgrades. Engine rumble and police siren audio are synthesized with the browser Web Audio API after the first input gesture, so no audio files are downloaded.

## Main menu, save slots and time of day

The main menu has three local save slots. Select an occupied slot and choose **Continue** to load it, or choose **New Game** to start fresh in the selected slot; replacing an occupied slot asks for confirmation. The old single-save format is migrated into Slot 1 when available. Each slot stores licence progress, mission credits/completions, vehicle tuning and location, and the current world time.

The city runs a continuous 24-hour cycle (about 12 real-time minutes per full day): dawn, daylight, dusk and night update the sky, fog, sunlight, ambient lighting and building-window glow. Street lamps and vehicle headlights fade on automatically after dusk; the player's car and police cruisers also use forward spotlights. The world clock appears in the HUD, and its time is restored with the selected save.

Use the **RAIN / DRY** weather button to start or clear a rain shower. Rain is rendered with a lightweight moving line field, road materials become darker and smoother, and lamp reflections appear on the streets. The selected weather state is saved with the active slot.

The city, cars, pedestrians, buildings, traffic lights, police vehicles, route markers, minimap, HUD and collision geometry are generated at runtime from primitive low-poly meshes. No external game assets are required.