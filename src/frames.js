import {hashCode} from "./helpers";

let _frameName = null;
let _frames = {};
if(window === window.top)
{
  _frameName = '';
  addFrame(_frameName, -1, window.origin, true);
}

const actions = {
  READY: '_ready', // iframe notifies top that it is ready
  PROBE: '_probe', // handshake with frame to see if it accepts messages
  MESSAGE_RESPONSE: '_message_response',
};

const listeners = {};

function addFrame(name, id, origin)
{
  const obj = {id: id, name: name};
  if(origin !== undefined)
  {
    obj['origin'] = origin;
  }
  if(!_frames[name])
  {
    _frames[name] = obj;
  }
  else
  {
    Object.assign(_frames[name], obj);
  }
}

function _getEnvelope(action, to, toOrigin, payload)
{
  return {
    messageId: action + ':' + hashCode(Date.now() + to + payload),
    action: action,
    to: to,
    toOrigin: toOrigin,
    from: _frameName,
    fromOrigin: window.origin,
    payload: payload,
  };
}

export function getFrameName()
{
  return _frameName;
}

// send messages
export function sendMessage(frameName, action, payload, callback)
{
  const frm = _frames[frameName];
  if(frm)
  {
    const envelope = _getEnvelope(action, frameName, frm.origin, payload);
    const targetWindow = frm.id < 0 ? window.top : window.top.frames[frm.id];
    _sendWindowMessage(targetWindow, frm.origin, envelope, callback);
  }
  else
  {
    console.warn('frame does not exist', frameName);
  }
}

function _sendWindowMessage(targetWindow, origin, envelope, callback)
{
  if(callback)
  {
    addActionListener(_getResponseAction(envelope.messageId), callback);
  }
  targetWindow.postMessage(JSON.stringify(envelope), origin);
}

// listen to messages
window.addEventListener('message', (msg) =>
{
  if(msg.isTrusted && msg.data)
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
    if(['action', 'to', 'toOrigin', 'from', 'fromOrigin', 'payload'].every((value) => envelope.hasOwnProperty(value)))
    {
      // is this definitely for me?
      if(((envelope.toOrigin === '*') || envelope.toOrigin === window.origin) && (_frameName === null || _frameName === envelope.to))
      {
        if(listeners.hasOwnProperty(envelope.action))
        {
          const responseCallback = (responsePayload, cb) =>
          {
            const responseEnvelope = _getEnvelope(
              _getResponseAction(envelope.messageId),
              envelope.from,
              envelope.fromOrigin,
              responsePayload
            );
            _sendWindowMessage(msg.source, msg.origin, responseEnvelope, cb);
          };
          listeners[envelope.action].forEach(
            (callback) =>
            {
              callback(envelope.payload, responseCallback, msg.source, msg.origin);
            })
        }
      }
    }
  }
});

export function addActionListener(action, callback)
{
  if(!listeners.hasOwnProperty(action))
  {
    listeners[action] = [];
  }
  listeners[action].push(callback);
}

function _getResponseAction(messageId)
{
  return actions.MESSAGE_RESPONSE + ':' + hashCode(messageId);
}

if(window === window.top)
{ // listen for iframe deletions
  if(window.MutationObserver)
  {
    var observer = new MutationObserver(
      (mutations) =>
      {
        // check for removed target
        mutations.forEach(
          (mutation) =>
          {
            const nodes = Array.from(mutation.removedNodes);
            nodes.forEach(
              (node) =>
              {
                _iframesRemoved((node.matches('iframe')) ? [node] : node.querySelectorAll('iframe'));
              });
          });
      });
    observer.observe(document, {subtree: true, childList: true});
  }
  else
  {
    document.addEventListener('DOMNodeRemoved', function (e)
    {
      _iframesRemoved((e.target.matches('iframe')) ? [e.target] : e.target.querySelectorAll('iframe'));
    });
  }

  function _iframesRemoved(iframes)
  {
    if(iframes.length)
    {
      iframes.forEach(
        (iframe) =>
        {
          if(iframe.hasAttribute('courier-name'))
          {
            const name = iframe.getAttribute('courier-name');
            if(name && _frames[name])
            {
              delete _frames[name];
            }
          }
        });
      updateFrames();
    }
  }

  // listen to ready messages
  addActionListener(
    actions.READY,
    (payload, response, src, origin) =>
    {
      // build frames
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(
        (iframe) =>
        {
          if(iframe.hasAttribute('courier-name'))
          {
            const name = iframe.getAttribute('courier-name');
            const frameId = _findFrameId(iframe);
            if(iframe.contentWindow === src && frameId !== false)
            {
              addFrame(name, frameId, origin);
            }
          }
        });
      updateFrames();
    }
  );

  function _findFrameId(iframe)
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

  function updateFrames()
  {
    // refresh ids
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(
      (iframe) =>
      {
        if(iframe.hasAttribute('courier-name'))
        {
          const frameId = _findFrameId(iframe);
          if(frameId !== false)
          {
            addFrame(iframe.getAttribute('courier-name'), frameId);
          }
        }
      });

    const frameHash = hashCode(JSON.stringify(_frames));

    Object.keys(_frames)
          .filter((name) => _frames[name].origin) // don't send init to main frame
          .forEach(
            (name) =>
            {
              sendMessage(name, actions.PROBE, 'hello ' + frameHash, (pl, respond) =>
              {
                if(pl === 'send ' + frameHash)
                { // send init
                  respond({name: name, frames: _frames});
                }
              });
            });
  }
}
else
{  // send probe to top
  _sendWindowMessage(window.top, '*', _getEnvelope(actions.READY, '', '*', 'hello'));

  addActionListener(actions.PROBE, (pl, respond) =>
  {
    const currentHash = hashCode(JSON.stringify(_frames));
    const spl = pl.split(' ', 2);

    if(currentHash === spl[1])
    { // hash matches, no need to update
      return;
    }

    respond(
      'send ' + spl[1],
      (initPayload) =>
      {
        _frameName = initPayload.name;
        _frames = initPayload.frames;
        document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {name: _frameName}}))
      }
    );
  });
}