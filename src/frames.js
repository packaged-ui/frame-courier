import debounce from 'debounce';
import hashSum from 'hash-sum';
import CustomEvent from 'custom-event';
import 'window-location-origin';
import {Frame} from "./assets/frame";

let _frameId = null;
/**
 * @type {{Frame}}
 * @private
 */
let _frames = {};

const _EVENT_PREFIX = '_frame_courier--';

const events = {
  LOADED: _EVENT_PREFIX + 'loaded', // iframe notifies top that it has loaded the script
  PROBE: _EVENT_PREFIX + 'probe', // handshake with frame to see if it accepts messages
  READY: _EVENT_PREFIX + 'ready', // iframe all other frames that it has been initialized and is ready to receive messages
  MESSAGE_RESPONSE: _EVENT_PREFIX + 'message-response',
};

const listeners = {};

/**
 * @param {Frame} frame
 */
function _addFrame(frame)
{
  if(_frames[frame.id])
  {
    console.warn('cannot add two frames with the same id');
    return;
  }
  _frames[frame.id] = frame;
  return frame;
}

/**
 * @param {String} id
 * @returns {Frame}
 */
function _getFrame(id)
{
  return _frames[id];
}

function _getEnvelope(event, to, toOrigin, payload)
{
  /* `undefined` payloads are unset in the envelope,
   * so are discarded as invalid in the delivery room.
   *
   * Set to null to ensure it always exists.
   */
  payload = payload || null;

  return {
    messageId: event + ':' + hashSum(Date.now() + to + payload),
    event: event,
    to: to,
    toOrigin: toOrigin,
    from: _frameId,
    fromOrigin: window.location.origin,
    payload: JSON.stringify(payload),
  };
}

function getId()
{
  return _frameId;
}

function getTags()
{
  return _frames[_frameId].tags;
}

/**
 * @callback MessageReply
 * @param {any} payload Will be serialized using JSON.stringify
 * @param {MessageReply} respond
 */

/**
 * Send a message to a specific frame
 *
 * @param {String} frameId   ID of the frame to send the message to
 * @param {String} event
 * @param {any} [payload]      Will be serialized using JSON.stringify
 * @param {MessageReply}  [callback]
 * @param {string}  [targetOrigin]
 */
function sendMessage(frameId, event, payload, callback, targetOrigin)
{
  const frm = _frames[frameId];
  if(frm)
  {
    if(!targetOrigin || (targetOrigin === frm.origin))
    {
      const envelope = _getEnvelope(event, frameId, frm.origin, payload);
      const targetWindow = frm.frameNumber < 0 ? window.top : window.top.frames[frm.frameNumber];
      if(targetWindow)
      {
        _sendWindowMessage(targetWindow, frm.origin, envelope, callback);
      }
      else
      {
        throw {message: 'target window is not accessible', data: frameId};
      }
    }
    else
    {
      throw {message: 'target origin does not match', data: frameId};
    }
  }
  else
  {
    throw {message: 'frame does not exist', data: frameId};
  }
}

function sendMessageToTag(tag, event, payload, callback, targetOrigin)
{
  Object.values(_frames).forEach(
    frame =>
    {
      if(frame.tags.indexOf(tag) > -1)
      {
        sendMessage(frame.id, event, payload, callback, targetOrigin);
      }
    });
}

function broadcast(event, payload, callback, targetOrigin)
{
  Object.values(_frames).forEach(
    frame =>
    {
      if(frame.id !== _frameId)
      {
        sendMessage(frame.id, event, payload, callback, targetOrigin);
      }
    });
}

function _sendWindowMessage(targetWindow, origin, envelope, callback)
{
  if(callback)
  {
    addListener(_getResponseEvent(envelope.messageId), callback);
  }
  targetWindow.postMessage(JSON.stringify(envelope), origin);
}

// listen to messages
window.addEventListener('message', (msg) =>
{
  if(msg.data)
  {
    let envelope;
    try
    {
      envelope = JSON.parse(msg.data);
    }
    catch(e)
    {
      return;
    }
    if(['event', 'to', 'toOrigin', 'from', 'fromOrigin', 'payload'].every((value) => envelope.hasOwnProperty(value)))
    {
      // is this definitely for me?
      if(((envelope.toOrigin === '*') || envelope.toOrigin === window.location.origin) && (_frameId === null || _frameId === envelope.to))
      {
        const payload = JSON.parse(envelope.payload);
        if(listeners.hasOwnProperty(envelope.event))
        {
          const responseCallback = (responsePayload, cb) =>
          {
            const responseEnvelope = _getEnvelope(
              _getResponseEvent(envelope.messageId),
              envelope.from,
              envelope.fromOrigin,
              responsePayload
            );
            _sendWindowMessage(msg.source, msg.origin, responseEnvelope, cb);
          };
          listeners[envelope.event].forEach(
            (callback) =>
            {
              callback(payload, responseCallback, msg.source, msg.origin);
            })
        }
      }
    }
  }
});

function addListener(event, callback)
{
  if(!listeners.hasOwnProperty(event))
  {
    listeners[event] = [];
  }
  listeners[event].push(callback);
}

function _getResponseEvent(messageId)
{
  return events.MESSAGE_RESPONSE + ':' + hashSum(messageId);
}

if(window === window.top)
{
  _frameId = '';
  _addFrame(new Frame('', [], -1, window.location.origin));

  // listen for iframe deletions
  if(window.MutationObserver)
  {
    (new MutationObserver(
        (mutations) =>
        {
          // check for removed target
          mutations.forEach(
            (mutation) =>
            {
              Array.from(mutation.removedNodes)
                   .filter((node) => node.nodeType === Node.ELEMENT_NODE)
                   .forEach(
                     (node) =>
                     {
                       _iframesRemoved((node.matches('iframe')) ? [node] : node.querySelectorAll('iframe'));
                     });
            });
        })
    ).observe(document, {subtree: true, childList: true});
  }
  else
  {
    document.addEventListener('DOMNodeRemoved', function (e)
    {
      if(e.target.nodeType === Node.ELEMENT_NODE)
      {
        _iframesRemoved((e.target.matches('iframe')) ? [e.target] : e.target.querySelectorAll('iframe'));
      }
    });
  }

  const debouncedUpdateFrames = debounce(_updateFrames, 10);

  function _iframesRemoved(iframes)
  {
    if(iframes.length)
    {
      iframes.forEach(
        (iframe) =>
        {
          if(iframe.hasAttribute('courier-id'))
          {
            const frameId = iframe.getAttribute('courier-id');
            if(frameId && _frames[frameId])
            {
              delete _frames[frameId];
            }
          }
        });
      debouncedUpdateFrames();
    }
  }

  // listen to ready messages
  addListener(
    events.LOADED,
    (payload, response, src, origin) =>
    {
      // build frames
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(
        (iframe) =>
        {
          if(iframe.contentWindow === src)
          {
            _refreshFrame(iframe, origin);
          }
        });
      debouncedUpdateFrames();
    }
  );

  function _refreshFrame(iframeElement, origin)
  {
    if(!iframeElement.hasAttribute('courier-id'))
    {
      if(!origin)
      {
        // this frame is has not loaded FrameCourier (yet?)
        return;
      }
      iframeElement.setAttribute('courier-id', 'frame-' + _randomString())
    }
    const frameId = iframeElement.getAttribute('courier-id');
    const frameTags = iframeElement.getAttribute('courier-tags');
    const frameNumber = _findFrameNumber(iframeElement);

    const frame = _getFrame(frameId);
    if(frame)
    {
      frame.setFrameNumber(frameNumber);
      if(origin)
      {
        frame.setOrigin(origin);
      }
    }
    else
    {
      _addFrame(new Frame(frameId, frameTags, frameNumber, origin));
    }
  }

  function _findFrameNumber(iframe)
  {
    for(let i = 0; i < window.frames.length; i++)
    {
      if(iframe.contentWindow === window.frames[i])
      {
        return i;
      }
    }
    return false;
  }

  function _updateFrames()
  {
    // refresh ids
    document.querySelectorAll('iframe').forEach(iframe => _refreshFrame(iframe));

    const frameHash = hashSum(JSON.stringify(_frames));

    Object.keys(_frames)
          .filter((frameId) => _frames[frameId].origin) // don't send init to main frame
          .forEach(
            (frameId) =>
            {
              sendMessage(frameId, events.PROBE, 'hello ' + frameHash, (pl, respond) =>
              {
                if(pl === 'send ' + frameHash)
                { // send init
                  respond({frameId: frameId, frames: _frames});
                }
              });
            });
  }
}
else
{
  // send loaded to top
  _sendWindowMessage(window.top, '*', _getEnvelope(events.LOADED, '', '*', 'hello'));

  let ready = false;
  addListener(events.PROBE, (pl, respond) =>
  {
    const currentHash = hashSum(JSON.stringify(_frames));
    const spl = pl.split(' ', 2);

    if(currentHash === spl[1])
    { // hash matches, no need to update
      return;
    }

    respond(
      'send ' + spl[1],
      (initPayload) =>
      {
        _frameId = initPayload.frameId;
        Object.values(initPayload.frames).map(frame => Frame.fromObject(frame));
        _frames = initPayload.frames;

        if(!ready)
        {
          ready = true;
          document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {frameId: _frameId}}));
          broadcast(events.READY, _frameId)
        }
      }
    );
  });
}

function _randomString()
{
  return parseInt(Math.random().toFixed(16).slice(2, 19)).toString(36);
}

export const FrameCourier = {
  send: sendMessage,
  sendToTag: sendMessageToTag,
  broadcast,
  id: getId,
  tags: getTags,
  listen: addListener,
  events,
  frames: _frames
}
