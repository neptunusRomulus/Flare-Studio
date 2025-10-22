
<img width="427" height="107" alt="flare-logo" src="https://github.com/user-attachments/assets/a01a6f21-3382-4b98-ac89-d6982e4d03c5" />

Flare studio is a graphical user interface for [Flare Engine](https://github.com/flareteam/flare-engine) which is a is a simple game engine built to handle single-player 2D action RPGs. This project aims to improve the user experience of the engine and encourage users to make more games with Flare Engine. Flare Studio is at its the Alpha Stage — expect incomplete features and active development and use it with your own risk. 

## Features
- Creating isometrics maps
- **Isometric Tile Editor** with 64x32 fixed tile size
- **Background Multi-layer Support** (Ground, Wall, Decor)
- **Collision Layer** editing
- Tilesetdefs, spawn, settings gets created automaticly.
- Only tested in windows11 but potentially works on linux and macos.


## How to Install?

*  Go to the Releases page
*  Downloaded for your OS. (Warning! So far, It is only tested for Windows11)
*  Run

## How to Use?

*  Create a project and your first map.
*  Import a tileset from your local with the little orange button at the leftsidebar, when in background layer.
*  Paint your map with your tileset at background layer.
*  Then switch to "collision layer" and make some paintings in there too.
* Export your project with the orange three string orange button at left sidebar.
* After exporting just copy and paste your project folder to the Flare's "mods" folder. Nothing else is needed. Enjoy game development with Flare!

## Screenshots;

<img src="https://github.com/user-attachments/assets/8663e7c5-920f-478e-b2b1-d41cf672eaae" width="600" />
<img src="https://github.com/user-attachments/assets/544c61f1-dc8f-48c9-8339-249782f6176f" width="600" />
<img src="https://github.com/user-attachments/assets/45bcdfbb-7bdf-4d78-b8a3-4ce2f1a0973d" width="300" />
<img src="https://github.com/user-attachments/assets/8528aaca-fa83-483f-8a72-d8cfbefdf298" width="300" />
<img src="https://github.com/user-attachments/assets/9a91cd54-38a3-4941-893f-2365f186a245" width="400" />


## Video

Coming Soon...


## 📦 Roadmap

⚡ **Alpha Version**

- [x] 1- Maps 
- [x] 2- Collisions


---
#### ⚡ **Beta Version** 
- [ ] 0- Multi-tileset use with "Tabs" (I'm working on it)
- [ ] 1- Objects (In progress)
- [ ] 2- Events (In progress) 
- [ ] 3- NPCs (In progress)
- [ ] 4- Enemies (In progress)
- [ ] 5- Dialogue
- [ ] 6- Sounds
- [ ] 7- Quest  
- [ ] 8- Cutscenes  
- [ ] 9- **You name it. I will check on it. Promise.**

---
#### ⚡ **Full Release** (Maybe)

- [ ] 9- UI Edits
- [ ] 10- Skills
- [ ] 12- Stats
- [ ] 13- Localization Editor
- [ ] 14- Shaders (with injection method)
- [ ] 15- Particles
- [ ] 16- **You name it. I will check on it. Promise.**
  


## Development

Warning! This software developed by a non-programmer person with AI assistants. So, because of that the codebase is probably like hell... However, If you still want to work on it; 
Run this single commands to start development after cloning the repo;

```bash
npm install
npm run go
```


This will:

- Install dependencies (if needed)
- Start Vite dev server
- Launch Electron app automatically

Enjoy exploring Flare Studio, the editor is evolving, feedbacks are always welcome. **Go make games!**
