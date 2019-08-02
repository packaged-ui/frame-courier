import {addListener, getName, sendMessage} from "./src/frames";

export default {
  listen: addListener,
  send: sendMessage,
  name: getName,
};