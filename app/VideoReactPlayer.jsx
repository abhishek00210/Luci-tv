'use client';

import { forwardRef } from 'react';
import { ControlBar, ForwardControl, Player, ReplayControl } from 'video-react';

const VideoReactPlayer = forwardRef(function VideoReactPlayer({ children, ...props }, ref) {
  return (
    <Player ref={ref} {...props}>
      {children}
      <ControlBar>
        <ReplayControl seconds={10} order={2.1} />
        <ForwardControl seconds={10} order={3.1} />
      </ControlBar>
    </Player>
  );
});

export default VideoReactPlayer;
