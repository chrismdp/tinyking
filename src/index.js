// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import * as PIXI from "pixi.js";

import "./style.scss";

let app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: true,
  resolution: 1
});
app.renderer.backgroundColor = 0x444444;
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";

app.renderer.autoResize = true;
window.onresize = () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
};

document.body.appendChild(app.view);

let message = new PIXI.Text("Tiny King", new PIXI.TextStyle({ fill: "white" }));
message.position.set(window.innerWidth * 0.5, 50);
message.anchor.x = 0.5;
app.stage.addChild(message);

let disclaimer = new PIXI.Text("Technical Demo. All features in very early stages and subject to change. Copyright (c) 2020 Think Code Learn Ltd t/a Revelation Games", new PIXI.TextStyle({ fill: "white", fontSize: 9 }));
disclaimer.position.set(3, window.innerHeight - 3);
disclaimer.anchor.y = 1.0;
app.stage.addChild(disclaimer);
