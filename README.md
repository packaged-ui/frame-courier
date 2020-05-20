## FrameCourier

High level interface to window.postMessage.
This package makes it easy to send and receive secure messages cross-origin.

### Launching Demo

1. Compile the distribution (`yarn install && yarn build`)
2. Serve the demo. The simplest way (if you have php enabled) is to use the php built-in webserver `php -s localhost:8111 -t .`
3. Open the browser http://localhost:8111/demo/

### Basic Usage

#### Frames

FrameCourier requires frames to be named.  This name will be used as the target of communication of `FrameCourier.sendMessage`

```html
<body>
  <iframe courier-name="myframe" src="/myframe.html"></iframe>
</body>
```

#### Listeners

```javascript
FrameCourier.listen(
  'my event',
  function(payload) { alert(payload); }
);
```

#### Sending Messages

```javascript
FrameCourier.send(
  'myframe',     // target frame name
  'my event',    // event (listener)
  'my message'   // payload
);
```

### Advanced Usage

#### Bidirectional communication

Use built in response callbacks to send messages back to the originating frame.

```javascript
FrameCourier.listen(
  'my event',
  function(payload, respond) { alert(payload); respond('response payload'); }
);
```

```javascript
FrameCourier.send(
  'myframe',     // target frame name
  'my event',   // action (listener)
  'my message',  // payload
  function(responsePayload) { alert('got response: ' + responsePayload); }
);
```

## Implementation

 - Use `/dist/frame-courier.min.js` to have `FrameCourier` assigned as a global variable.
 - Import `/src/index.js` into your script to assign to your own internal variable.