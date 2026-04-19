import "./styles.css";
import { createPlayground } from "./app";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element.");
}

createPlayground(root);
