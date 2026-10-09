// Copies browser-only libraries into public/vendor so the static export serves them from the
// Tally computer itself: the phone may have no internet. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/@techstark/opencv-js/dist/opencv.js", "public/vendor/opencv.js");
