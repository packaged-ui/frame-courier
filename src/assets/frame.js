import {Envelope} from "./messages";

let _frameId = null;
let _frameTags = [];

/**
 * @type {Map<String,Frame>}
 * @private
 */
const _frames = new Map();
const _listeners = new Map();

/**
 * @param {String} id
 */
export function setId(id)
{
  if(_frameId !== null)
  {
    throw 'frame id already set';
  }
  _frameId = id;
}

export function getId()
{
  return _frameId;
}

/**
 * @param {String[]} tags
 */
export function setTags(tags)
{
  _frameTags = tags || [];
}

export function getTags()
{
  return _frameTags || [];
}

/**
 * @param {Frame} frame
 */
export function addFrame(frame)
{
  if(_frames.has(frame.id))
  {
    console.warn('cannot add two frames with the same id');
    return;
  }
  console.debug('established channel with', frame.id);
  _frames.set(frame.id, frame);
  return frame;
}

/**
 * @param {String} id
 * @returns {Frame}
 */
export function getFrame(id)
{
  return _frames.get(id);
}

/**
 * @returns {Frame[]}
 */
export function getAllFrames()
{
  return Array.from(_frames.values());
}

export class Frame
{
  /**
   * @param {String} id
   * @param {String[]} tags
   * @param {String} origin
   * @param {MessagePort} port
   */
  constructor(id, tags, origin, port)
  {
    tags = tags || [];
    if(typeof tags === 'string')
    {
      tags = tags.split(/\s+/);
    }
    else if(!Array.isArray(tags))
    {
      console.warn('invalid tags for frame', {id, tags})
      tags = [];
    }

    this._id = id;
    this._tags = typeof tags === 'string' ? tags.split(/\s+/) : tags;
    this._origin = origin;
    this.setPort(port);
  }

  get id()
  {
    return this._id;
  }

  get tags()
  {
    return this._tags;
  }

  get origin()
  {
    return this._origin;
  }

  setPort(port)
  {
    if(this._port)
    {
      this._port.close();
    }

    this._port = port;
    this._port.addEventListener('message', (msg) =>
    {
      const envelope = Envelope.fromString(msg.data);
      const listeners = _listeners.get(envelope.event);

      const responseCallback = (responsePayload, cb) =>
      {
        this.send(envelope.responseEvent, responsePayload, cb);
      };
      listeners.forEach(callback => callback(envelope.payload, responseCallback, envelope, msg));
    });
    this._port.start();
  }

  /**
   * @param {String} event
   * @param {any} payload
   * @param {Function?} callback
   */
  send(event, payload, callback)
  {
    const envelope = new Envelope(this.id, _frameId, event, payload);
    if(callback)
    {
      this.listen(envelope.responseEvent, callback)
    }
    this._port.postMessage(envelope.toString());
  }

  listen(event, callback)
  {
    addListener(event, callback);
  }
}

export function addListener(event, callback)
{
  if(!_listeners.has(event))
  {
    _listeners.set(event, [callback]);
  }
  else
  {
    _listeners.get(event).push(callback);
  }
}
