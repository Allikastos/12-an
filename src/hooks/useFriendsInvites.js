import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

export function useFriendsInvites({ userId, roomId, kingHistory, joinRoom }) {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [friendStats, setFriendStats] = useState({});
  const [roomInvites, setRoomInvites] = useState([]);
  const [sentInvites, setSentInvites] = useState({});

  const loadFriendsAndRequests = useCallback(async (uid) => {
    if (!uid) {
      setFriends([]);
      setFriendRequests({ incoming: [], outgoing: [] });
      return;
    }

    const { data: friendRows } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", uid);
    const friendIds = (friendRows ?? []).map((r) => r.friend_id).filter(Boolean);

    if (friendIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", friendIds);
      setFriends(profileRows ?? []);
    } else {
      setFriends([]);
    }

    const { data: incomingRows } = await supabase
      .from("friend_requests")
      .select("id, requester_id, addressee_id, status")
      .eq("addressee_id", uid)
      .eq("status", "pending");
    const incomingIds = (incomingRows ?? []).map((r) => r.requester_id).filter(Boolean);
    let incoming = [];
    if (incomingIds.length) {
      const { data: incomingProfiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", incomingIds);
      const byId = new Map((incomingProfiles ?? []).map((p) => [p.id, p]));
      incoming = (incomingRows ?? []).map((r) => ({
        id: r.id,
        requester: byId.get(r.requester_id),
      }));
    }

    const { data: outgoingRows } = await supabase
      .from("friend_requests")
      .select("id, requester_id, addressee_id, status")
      .eq("requester_id", uid)
      .eq("status", "pending");
    const outgoingIds = (outgoingRows ?? []).map((r) => r.addressee_id).filter(Boolean);
    let outgoing = [];
    if (outgoingIds.length) {
      const { data: outgoingProfiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", outgoingIds);
      const byId = new Map((outgoingProfiles ?? []).map((p) => [p.id, p]));
      outgoing = (outgoingRows ?? []).map((r) => ({
        id: r.id,
        addressee: byId.get(r.addressee_id),
      }));
    }

    setFriendRequests({ incoming, outgoing });
  }, []);

  const searchProfiles = useCallback(async () => {
    if (!userId) return;
    const q = friendSearch.trim();
    if (!q) {
      setFriendResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${q}%`)
      .limit(20);
    const filtered = (data ?? []).filter((p) => p.id !== userId);
    setFriendResults(filtered);
  }, [friendSearch, userId]);

  const sendFriendRequest = useCallback(async (targetId) => {
    if (!userId || !targetId) return;
    await supabase.from("friend_requests").upsert({
      requester_id: userId,
      addressee_id: targetId,
      status: "pending",
    });
    await loadFriendsAndRequests(userId);
  }, [userId, loadFriendsAndRequests]);

  const acceptFriendRequest = useCallback(async (requestId, requesterId) => {
    if (!userId || !requestId || !requesterId) return;
    await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", requestId);
    await supabase.from("friends").upsert([
      { user_id: userId, friend_id: requesterId },
      { user_id: requesterId, friend_id: userId },
    ]);
    await loadFriendsAndRequests(userId);
  }, [userId, loadFriendsAndRequests]);

  const declineFriendRequest = useCallback(async (requestId) => {
    if (!requestId) return;
    await supabase.from("friend_requests").delete().eq("id", requestId);
    if (userId) await loadFriendsAndRequests(userId);
  }, [userId, loadFriendsAndRequests]);

  const removeFriend = useCallback(async (friendId) => {
    if (!userId || !friendId) return;
    await supabase.from("friends").delete().eq("user_id", userId).eq("friend_id", friendId);
    await supabase.from("friends").delete().eq("user_id", friendId).eq("friend_id", userId);
    await loadFriendsAndRequests(userId);
  }, [userId, loadFriendsAndRequests]);

  const loadFriendStatsFor = useCallback(async (friendId) => {
    if (!friendId) return;
    const { data: rows } = await supabase
      .from("match_players")
      .select("match_id, is_winner, rounds")
      .eq("profile_id", friendId);

    const matches = new Set();
    let wins = 0;
    let blitzWins = 0;
    let totalRounds = 0;
    let winRoundsCount = 0;

    (rows ?? []).forEach((r) => {
      const isNormal = Boolean(r.match_id);
      if (isNormal) matches.add(r.match_id);
      if (r.is_winner) {
        if (isNormal) {
          wins += 1;
          if (typeof r.rounds === "number") {
            totalRounds += r.rounds;
            winRoundsCount += 1;
          }
        } else {
          blitzWins += 1;
        }
      }
    });

    const matchCount = matches.size;
    const winRatio = matchCount ? wins / matchCount : null;
    const avgRoundsToWin = winRoundsCount ? totalRounds / winRoundsCount : null;
    const kingCount = kingHistory.filter((k) => k.winner?.id === friendId).length;

    setFriendStats((prev) => ({
      ...prev,
      [friendId]: { wins, blitzWins, winRatio, avgRoundsToWin, kingCount },
    }));
  }, [kingHistory]);

  const loadRoomInvites = useCallback(async (uid) => {
    if (!uid) {
      setRoomInvites([]);
      return;
    }
    const { data: inviteRows } = await supabase
      .from("room_invites")
      .select("id, room_id, sender_profile_id, recipient_profile_id, status, created_at")
      .eq("recipient_profile_id", uid)
      .eq("status", "pending");
    const roomIds = (inviteRows ?? []).map((r) => r.room_id).filter(Boolean);
    const senderIds = (inviteRows ?? []).map((r) => r.sender_profile_id).filter(Boolean);

    const { data: rooms } = roomIds.length
      ? await supabase.from("rooms").select("id, code").in("id", roomIds)
      : { data: [] };
    const { data: senders } = senderIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", senderIds)
      : { data: [] };

    const roomById = new Map((rooms ?? []).map((r) => [r.id, r]));
    const senderById = new Map((senders ?? []).map((s) => [s.id, s]));

    const mapped = (inviteRows ?? []).map((r) => ({
      id: r.id,
      roomId: r.room_id,
      roomCode: roomById.get(r.room_id)?.code ?? "",
      sender: senderById.get(r.sender_profile_id) ?? null,
    }));
    setRoomInvites(mapped);
  }, []);

  const sendRoomInvite = useCallback(async (friendId) => {
    if (!userId || !roomId || !friendId) return;
    await supabase.from("room_invites").upsert(
      {
        room_id: roomId,
        sender_profile_id: userId,
        recipient_profile_id: friendId,
        status: "pending",
      },
      { onConflict: "room_id,recipient_profile_id" }
    );
    const sentAt = Date.now();
    setSentInvites((prev) => ({ ...prev, [friendId]: sentAt }));
    setTimeout(() => {
      setSentInvites((prev) => {
        if (prev?.[friendId] !== sentAt) return prev;
        const next = { ...prev };
        delete next[friendId];
        return next;
      });
    }, 8000);
  }, [roomId, userId]);

  const acceptRoomInvite = useCallback(async (invite) => {
    if (!invite?.id || !invite?.roomCode) return;
    await supabase.from("room_invites").update({ status: "accepted" }).eq("id", invite.id);
    await joinRoom(invite.roomCode);
  }, [joinRoom]);

  const declineRoomInvite = useCallback(async (inviteId) => {
    if (!inviteId) return;
    await supabase.from("room_invites").delete().eq("id", inviteId);
    if (userId) await loadRoomInvites(userId);
  }, [userId, loadRoomInvites]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user:${userId}:invites`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `addressee_id=eq.${userId}` },
        () => loadFriendsAndRequests(userId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `requester_id=eq.${userId}` },
        () => loadFriendsAndRequests(userId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends", filter: `user_id=eq.${userId}` },
        () => loadFriendsAndRequests(userId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_invites", filter: `recipient_profile_id=eq.${userId}` },
        () => loadRoomInvites(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadFriendsAndRequests, loadRoomInvites]);

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      void loadRoomInvites(userId);
      void loadFriendsAndRequests(userId);
    }, 7000);
    return () => clearInterval(id);
  }, [userId, loadRoomInvites, loadFriendsAndRequests]);

  return {
    friends,
    friendRequests,
    friendSearch,
    setFriendSearch,
    friendResults,
    friendStats,
    roomInvites,
    sentInvites,
    loadFriendsAndRequests,
    searchProfiles,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    loadFriendStatsFor,
    loadRoomInvites,
    sendRoomInvite,
    acceptRoomInvite,
    declineRoomInvite,
  };
}
