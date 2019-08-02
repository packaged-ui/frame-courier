import {addListener, getName, sendMessage} from "./frames";

export default {
  listen: addListener,
  send: sendMessage,
  name: getName,
};