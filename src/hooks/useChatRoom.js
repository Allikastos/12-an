import { useCallback, useRef, useState } from "react";
import { supabase } from "../supabase";

export function useChatRoom() {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatUnread, setChatUnread] = useState(0);
  const [chatToasts, setChatToasts] = useState([]);
  const lastChatIdRef = useRef(null);

  const pushToast = useCallback((text) => {
    const toastId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setChatToasts((prev) => [...prev, { id: toastId, text }]);
    setTimeout(() => {
      setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 5000);
  }, []);

  const loadChat = useCallback(async (room) => {
    if (!room) {
      setChatMessages([]);
      return;
    }
    const { data } = await supabase
      .from("room_messages")
      .select("id, sender_name, body, created_at")
      .eq("room_id", room)
      .order("created_at", { ascending: true })
      .limit(200);
    const rows = data ?? [];
    if (rows.length) {
      const lastId = lastChatIdRef.current;
      if (!lastId) {
        lastChatIdRef.current = rows[rows.length - 1]?.id ?? null;
      } else {
        const lastIdx = rows.findIndex((r) => r.id === lastId);
        const newRows = lastIdx >= 0 ? rows.slice(lastIdx + 1) : rows.slice(-1);
        if (newRows.length) {
          newRows.forEach((msg) => {
            pushToast(`${msg.sender_name}: ${msg.body}`);
          });
          lastChatIdRef.current = rows[rows.length - 1]?.id ?? lastChatIdRef.current;
        }
      }
    }
    setChatMessages(rows);
  }, [pushToast]);

  const handleIncomingMessage = useCallback((msg) => {
    if (!msg) return;
    setChatMessages((prev) => [...prev, msg]);
    setChatUnread((n) => n + 1);
    pushToast(`${msg.sender_name}: ${msg.body}`);
  }, [pushToast]);

  const sendChat = useCallback(async ({ roomId, userId, playerId, senderName }) => {
    const body = chatInput.trim();
    if (!body || !roomId) return;
    await supabase.from("room_messages").insert({
      room_id: roomId,
      sender_profile_id: userId ?? null,
      sender_player_id: playerId ?? null,
      sender_name: senderName,
      body,
    });
    setChatInput("");
  }, [chatInput]);

  const markChatOpened = useCallback(() => {
    setChatUnread(0);
  }, []);

  return {
    chatMessages,
    chatInput,
    setChatInput,
    chatUnread,
    chatToasts,
    loadChat,
    sendChat,
    handleIncomingMessage,
    markChatOpened,
  };
}
