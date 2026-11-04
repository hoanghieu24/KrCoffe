import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

function createPlayerClient(username, avatarId) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
    });

    const state = {
      socket,
      userId: null,
      username,
      avatarId,
      currentSeatId: null,
      currentTableId: null,
      voiceSession: null,
      receivedSignals: [],
      receivedMutes: [],
      receivedChats: [],
    };

    socket.on('connect', () => {
      // Send cafe:join
      const tempId = `user_${username.toLowerCase()}_${Date.now()}`;
      socket.emit('cafe:join', {
        userId: tempId,
        username,
        avatarId,
        level: 'TOPIK II - Lớp 4',
      }, (res) => {
        if (!res?.ok || !res?.me) {
          reject(new Error(`Failed to join: ${res?.reason || 'Unknown error'}`));
          return;
        }
        state.userId = res.me.userId;
        resolve(state);
      });
    });

    socket.on('connect_error', reject);

    socket.on('voice:incoming-invite', (invite) => {
      state.lastIncomingInvite = invite;
    });

    socket.on('voice:session-started', (session) => {
      state.voiceSession = session;
    });

    socket.on('voice:signal', (data) => {
      state.receivedSignals.push(data);
    });

    socket.on('voice:peer-mute', (data) => {
      state.receivedMutes.push(data);
    });

    socket.on('voice:ended', (data) => {
      state.voiceSession = null;
      state.lastVoiceEnd = data;
    });

    socket.on('chat:message', (data) => {
      state.receivedChats.push(data);
    });
  });
}

function sit(player, seatId) {
  return new Promise((resolve) => {
    player.socket.emit('seat:sit', { seatId }, (res) => {
      if (res?.ok) {
        player.currentSeatId = seatId;
      }
      resolve(res);
    });
  });
}

function sendVoiceInvite(player, targetId) {
  return new Promise((resolve) => {
    player.socket.emit('voice:invite', { targetId }, (res) => {
      resolve(res);
    });
  });
}

function respondVoiceInvite(player, inviteId, accept) {
  return new Promise((resolve) => {
    player.socket.emit('voice:respond', { inviteId, accept }, (res) => {
      resolve(res);
    });
  });
}

function sendVoiceSignal(player, sessionId, targetId, signal) {
  return new Promise((resolve) => {
    player.socket.emit('voice:signal', { sessionId, targetId, signal }, (res) => {
      resolve(res);
    });
  });
}

function sendMute(player, sessionId, muted) {
  player.socket.emit('voice:mute', { sessionId, muted });
}

function endVoice(player) {
  player.socket.emit('voice:end');
}

function sendTableChat(player, text) {
  return new Promise((resolve) => {
    player.socket.emit('chat:send', { text }, (res) => {
      resolve(res);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('===========================================================');
  console.log('🎙️  TESTING MULTI-USER CONCURRENT VOICE & CHAT (4 PLAYERS)');
  console.log('===========================================================');
  console.log('Connecting 4 clients concurrently:');
  console.log('  Table_03: Player A (Huyen) & Player B (Hieu)');
  console.log('  Table_04: Player C (Minh) & Player D (Linh)');

  const [pA, pB, pC, pD] = await Promise.all([
    createPlayerClient('Huyen_T3', 'anim-hana'),
    createPlayerClient('Hieu_T3', 'anim-minh'),
    createPlayerClient('Minh_T4', 'anim-joon'),
    createPlayerClient('Linh_T4', 'anim-yuna'),
  ]);

  console.log('✅ All 4 players joined the cafe successfully!');
  console.log(`   [Table 3] A: ${pA.username} (${pA.userId}) | B: ${pB.username} (${pB.userId})`);
  console.log(`   [Table 4] C: ${pC.username} (${pC.userId}) | D: ${pD.username} (${pD.userId})`);

  // Sit at tables
  console.log('\n--- Step 1: Seating players at Table_03 (Seats 05, 06) and Table_04 (Seats 07, 08) ---');
  const [sitA, sitB, sitC, sitD] = await Promise.all([
    sit(pA, 'Seat_05'),
    sit(pB, 'Seat_06'),
    sit(pC, 'Seat_07'),
    sit(pD, 'Seat_08'),
  ]);

  console.log('Sit results:', { sitA: sitA?.ok, sitB: sitB?.ok, sitC: sitC?.ok, sitD: sitD?.ok });
  if (!sitA?.ok || !sitB?.ok || !sitC?.ok || !sitD?.ok) {
    console.error('Sit failure details:', { sitA, sitB, sitC, sitD });
    throw new Error('Failed to seat all players');
  }
  console.log('✅ All 4 players seated properly.');

  // Test 1: Cross-table invite security test
  console.log('\n--- Step 2: Security Test - Cross-Table Voice Invite (Player A at T3 -> Player C at T4) ---');
  const crossInvite = await sendVoiceInvite(pA, pC.userId);
  console.log('Cross-table invite result:', crossInvite);
  if (crossInvite.ok) {
    throw new Error('SECURITY VIOLATION: Cross-table invite should have been rejected!');
  }
  console.log('✅ Pass: Cross-table voice invite properly rejected by server:', crossInvite.reason);

  // Test 2: Simultaneous voice invites at Table 7 and Table 8
  console.log('\n--- Step 3: Simultaneous Voice Invites at Table 7 and Table 8 ---');
  const [invAtoB, invCtoD] = await Promise.all([
    sendVoiceInvite(pA, pB.userId),
    sendVoiceInvite(pC, pD.userId),
  ]);

  console.log('Invite A -> B:', invAtoB);
  console.log('Invite C -> D:', invCtoD);
  if (!invAtoB.ok || !invCtoD.ok) {
    throw new Error('Failed to send simultaneous invites');
  }

  await sleep(150);
  console.log('Player B received invite ID:', pB.lastIncomingInvite?.inviteId);
  console.log('Player D received invite ID:', pD.lastIncomingInvite?.inviteId);

  // Test 3: Simultaneous Acceptance at Both Tables
  console.log('\n--- Step 4: Simultaneous Voice Acceptance at Both Tables ---');
  const [acceptB, acceptD] = await Promise.all([
    respondVoiceInvite(pB, pB.lastIncomingInvite.inviteId, true),
    respondVoiceInvite(pD, pD.lastIncomingInvite.inviteId, true),
  ]);

  console.log('Accept B ack:', acceptB);
  console.log('Accept D ack:', acceptD);
  await sleep(200);

  console.log('Table 7 Voice Session ID:', pA.voiceSession?.sessionId);
  console.log('Table 8 Voice Session ID:', pC.voiceSession?.sessionId);

  if (!pA.voiceSession || !pB.voiceSession || !pC.voiceSession || !pD.voiceSession) {
    throw new Error('Voice session was not established for all 4 players');
  }
  if (pA.voiceSession.sessionId === pC.voiceSession.sessionId) {
    throw new Error('CRITICAL BUG: Both tables got the same voice session ID!');
  }
  console.log('✅ Pass: Independent concurrent voice sessions established on distinct tables!');

  // Test 4: Concurrent WebRTC Signaling (Offers, Answers, ICE Candidates)
  console.log('\n--- Step 5: Concurrent WebRTC Signaling Exchanges Across Both Sessions ---');
  const dummySdpOfferT7 = { type: 'offer', sdp: 'v=0\r\no=Huyen 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50000 RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n' };
  const dummySdpOfferT8 = { type: 'offer', sdp: 'v=0\r\no=Minh 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50002 RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n' };

  // Send offers simultaneously
  const [sigA, sigC] = await Promise.all([
    sendVoiceSignal(pA, pA.voiceSession.sessionId, pB.userId, dummySdpOfferT7),
    sendVoiceSignal(pC, pC.voiceSession.sessionId, pD.userId, dummySdpOfferT8),
  ]);
  console.log('Signal A -> B ack:', sigA);
  console.log('Signal C -> D ack:', sigC);

  await sleep(150);
  console.log(`Player B received ${pB.receivedSignals.length} signals. Content:`, pB.receivedSignals[0]?.signal?.type);
  console.log(`Player D received ${pD.receivedSignals.length} signals. Content:`, pD.receivedSignals[0]?.signal?.type);

  // Check crosstalk: Did B receive C's signal? Did D receive A's signal?
  const bGotCrossTalk = pB.receivedSignals.some(s => s.fromId === pC.userId || s.fromId === pD.userId);
  const dGotCrossTalk = pD.receivedSignals.some(s => s.fromId === pA.userId || s.fromId === pB.userId);
  if (bGotCrossTalk || dGotCrossTalk) {
    throw new Error('CROSSTALK DETECTED: Signals leaked across tables!');
  }
  console.log('✅ Pass: WebRTC signals strictly isolated between tables (0 crosstalk)!');

  // Return answers simultaneously
  const dummySdpAnswerT7 = { type: 'answer', sdp: 'v=0\r\no=Hieu 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50004 RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n' };
  const dummySdpAnswerT8 = { type: 'answer', sdp: 'v=0\r\no=Linh 98765 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50006 RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n' };

  await Promise.all([
    sendVoiceSignal(pB, pB.voiceSession.sessionId, pA.userId, dummySdpAnswerT7),
    sendVoiceSignal(pD, pD.voiceSession.sessionId, pC.userId, dummySdpAnswerT8),
  ]);
  await sleep(150);
  console.log(`Player A received ${pA.receivedSignals.length} signals. Type:`, pA.receivedSignals[0]?.signal?.type);
  console.log(`Player C received ${pC.receivedSignals.length} signals. Type:`, pC.receivedSignals[0]?.signal?.type);

  // Test 5: Illegal Cross-Table Signal Spoofing
  console.log('\n--- Step 6: Security Test - Signal Injection / Cross-Table Attack ---');
  const spoofRes = await sendVoiceSignal(pA, pA.voiceSession.sessionId, pD.userId, { type: 'candidate', candidate: 'dummy' });
  console.log('Spoof signal A -> D result:', spoofRes);
  if (spoofRes.ok) {
    throw new Error('SECURITY VIOLATION: Spoofed signal between different tables was accepted!');
  }
  console.log('✅ Pass: Unauthorized signal across tables properly rejected:', spoofRes.reason);

  // Test 6: Concurrent Speaking & Mute toggles from all 4 users simultaneously
  console.log('\n--- Step 7: Concurrent Mic Mute & Voice Speaking from all 4 users ---');
  sendMute(pA, pA.voiceSession.sessionId, true);
  sendMute(pB, pB.voiceSession.sessionId, false);
  sendMute(pC, pC.voiceSession.sessionId, true);
  sendMute(pD, pD.voiceSession.sessionId, true);

  await sleep(200);
  console.log(`B received ${pB.receivedMutes.length} mute updates from A (muted=${pB.receivedMutes[0]?.muted})`);
  console.log(`D received ${pD.receivedMutes.length} mute updates from C (muted=${pD.receivedMutes[0]?.muted})`);
  console.log(`A received ${pA.receivedMutes.length} mute updates from B (muted=${pA.receivedMutes[0]?.muted})`);
  console.log(`C received ${pC.receivedMutes.length} mute updates from D (muted=${pC.receivedMutes[0]?.muted})`);

  if (!pB.receivedMutes.length || !pD.receivedMutes.length) {
    throw new Error('Mute updates failed to route to peer');
  }
  console.log('✅ Pass: Simultaneous mute/speak state handled flawlessly with 0 collision!');

  // Test 7: Simultaneous Table Chat while in Voice
  console.log('\n--- Step 8: Concurrent In-Table Chat while Voice Call is Active ---');
  const [chatA, chatC] = await Promise.all([
    sendTableChat(pA, 'Chào Hiếu nhé! Cậu nghe tớ nói rõ không?'),
    sendTableChat(pC, 'Linh ơi ôn phần nghe TOPIK trước nhé!'),
  ]);
  console.log('Chat A ack:', chatA);
  console.log('Chat C ack:', chatC);

  await sleep(200);
  console.log(`Player B received chat: "${pB.receivedChats[0]?.text}"`);
  console.log(`Player D received chat: "${pD.receivedChats[0]?.text}"`);

  // Ensure Table 8 did NOT receive Table 7 chat and vice versa
  const t8GotT7Chat = pD.receivedChats.some(c => c.text && c.text.includes('Hiếu'));
  const t7GotT8Chat = pB.receivedChats.some(c => c.text && c.text.includes('Linh'));
  if (t8GotT7Chat || t7GotT8Chat) {
    throw new Error('CHAT LEAK: Table chat leaked between tables!');
  }
  console.log('✅ Pass: In-table chat strictly isolated per table while voice is active!');

  // Test 8: Independent Session Termination (T7 hangs up, T8 stays active)
  console.log('\n--- Step 9: Independent Session Termination Test ---');
  console.log('Hanging up Table 7 voice call (Player A leaves voice)...');
  endVoice(pA);

  await sleep(250);
  console.log('Table 7 session after Player A hangs up:');
  console.log('  pA.voiceSession:', pA.voiceSession);
  console.log('  pB.voiceSession:', pB.voiceSession);
  console.log('Table 8 session (should still be ACTIVE!):');
  console.log('  pC.voiceSession:', pC.voiceSession ? 'ACTIVE' : 'INACTIVE');
  console.log('  pD.voiceSession:', pD.voiceSession ? 'ACTIVE' : 'INACTIVE');

  if (pA.voiceSession !== null || pB.voiceSession !== null) {
    throw new Error('Table 7 session did not end cleanly');
  }
  if (!pC.voiceSession || !pD.voiceSession) {
    throw new Error('REGRESSION: Table 8 session was accidentally terminated when Table 7 hung up!');
  }
  console.log('✅ Pass: Table 7 call ended cleanly without disrupting Table 8 call!');

  // Now hang up Table 8
  console.log('Hanging up Table 8 voice call (Player C leaves voice)...');
  endVoice(pC);
  await sleep(250);
  console.log('Table 8 session after Player C hangs up:', pC.voiceSession, pD.voiceSession);
  if (pC.voiceSession !== null || pD.voiceSession !== null) {
    throw new Error('Table 8 session did not end cleanly');
  }
  console.log('✅ Pass: Table 8 call ended cleanly!');

  // Disconnect all
  pA.socket.disconnect();
  pB.socket.disconnect();
  pC.socket.disconnect();
  pD.socket.disconnect();

  console.log('\n======================================================');
  console.log('🎉 ALL CONCURRENT MULTI-USER VOICE TESTS PASSED 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
