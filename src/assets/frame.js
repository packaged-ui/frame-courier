import {Envelope} from "./messages";

let _frameId = null;
let _frameTags = [];

/**
 * @type {Map<String,Frame>}
 * @private
 */
const _frames = new Map();
/**
 * @type {Map<string, ListenerCallback[]>}
 * @private
 */
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
  //console.debug(_frameId, 'established channel with', frame.id);
  _frames.set(frame.id, frame);
  return frame;
}

/**
 * @returns {Map<String,Frame>}
 */
export function getAllFrames()
{
  return new Map(_frames);
}

export class Frame
{
  /**
   * @param {String} id
   * @param {String[]} tags
   * @param {String} origin
   * @param {MessagePort|Window} port
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
    this._msgListener = (msg) =>
    {
      const envelope = Envelope.fromString(msg.data);
      if(!envelope)
      {
        return;
      }
      if(envelope.to === getId() && envelope.from === this.id)
      {
        const listeners = _listeners.get(envelope.event);
        if(listeners)
        {
          const responseCallback = (responsePayload, cb) =>
          {
            this.send(envelope.responseEvent, responsePayload, cb);
          };
          listeners.forEach(callback => callback(envelope.payload, responseCallback, envelope, msg));
        }
      }
    };
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
    if(this._port && !_isWindow(this._port))
    {
      this._port.close();
    }
    this._port = port;

    if(this._port)
    {
      if(_isWindow(this._port))
      {
        // only bind listener once, to window
        window.removeEventListener('message', this._msgListener);
        window.addEventListener('message', this._msgListener);
      }
      else
      {
        // bind listener to message port
        this._port.removeEventListener('message', this._msgListener);
        this._port.addEventListener('message', this._msgListener);

        if(this._port.start)
        {
          this._port.start();
        }
      }
    }
  }

  /**
   * @param {String} event
   * @param {any} [payload]
   * @param {ListenerCallback} [callback]
   */
  send(event, payload, callback)
  {
    const envelope = new Envelope(this.id, _frameId, event, payload);
    if(callback)
    {
      this.listen(envelope.responseEvent, callback)
    }
    this._port.postMessage(envelope.toString(), this._port === this._port.window ? this.origin : null);
  }

  listen(event, callback)
  {
    addListener(event, callback);
  }
}

/**
 * @callback RespondCallback
 * @param {any} payload
 * @param {ListenerCallback} callback
 */

/**
 * @callback ListenerCallback
 * @param {any} payload
 * @param {RespondCallback} respond
 * @param {Envelope} envelope
 * @param {MessageEvent} messageEvent
 */

/**
 * @param {string} event
 * @param {ListenerCallback} callback
 */
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

function _isWindow(obj)
{
  try
  {
    return obj.window === obj;
  }
  catch(e)
  {
    return false;
  }
}
