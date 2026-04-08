import { Button } from "../../ui/Button";
import CanastaActionBar from "./CanastaActionBar";

export default function CanastaHandPanel({
  isMobile,
  myPlayer,
  mobileSortMode,
  toggleMobileSortMode,
  canSortHand,
  showLandscapeHandOverview,
  orderedHand,
  selectedIds,
  selectedSummary,
  recentDrawnIds,
  suppressTapRef,
  toggleSelect,
  handAreaRef,
  handAreaHeight,
  dragCardId,
  handReorderEnabled,
  resolveHandDropTarget,
  setHandDropSide,
  setHoverCardId,
  moveHandCard,
  handDropSide,
  dropMarkerX,
  handOffsetAt,
  handCenter,
  hoverCardId,
  pressedCardIdRef,
  pointerStartRef,
  longPressTimerRef,
  setDragCardId,
  handCardWidth,
  handCardHeight,
  renderCardFace,
  clearSelected,
  sortHandNow,
  drawTwo,
  takeDiscardStack,
  tryDiscardSelected,
  laySelected,
  canDrawFromStock,
  canPickDiscardPile,
  canDiscardSelectedCard,
  canLaySelectedCards,
  showTip,
}) {
  const hasSelection = selectedIds.length > 0;
  const mobileActions = hasSelection
    ? [
        {
          key: "lay",
          label: selectedSummary?.intentActionLabel ?? "Lägg ut",
          onPress: laySelected,
          disabled: !canLaySelectedCards,
          variant: "primary",
        },
        {
          key: "discard",
          label: "Kasta",
          onPress: tryDiscardSelected,
          disabled: !canDiscardSelectedCard,
        },
        {
          key: "clear",
          label: "Avmarkera",
          onPress: clearSelected,
        },
        {
          key: "sort",
          label: "Sortera",
          onPress: sortHandNow,
        },
      ]
    : [
        {
          key: "draw",
          label: "Dra från talong",
          onPress: drawTwo,
          disabled: !canDrawFromStock,
          variant: "primary",
        },
        {
          key: "pickup",
          label: "Ta kasthög",
          onPress: takeDiscardStack,
          disabled: !canPickDiscardPile,
        },
        {
          key: "sort",
          label: "Sortera",
          onPress: sortHandNow,
        },
        {
          key: "tip",
          label: "Tips",
          onPress: showTip,
        },
      ];

  if (isMobile) {
    return (
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 50,
          display: "grid",
          gap: 8,
          marginTop: 4,
        }}
      >
        <CanastaActionBar
          title={hasSelection ? `${selectedIds.length} selected` : "Actions"}
          subtitle={hasSelection ? selectedSummary?.intentLabel ?? selectedSummary?.openingValueLabel ?? "" : ""}
          actions={mobileActions}
        />

        <div
          style={{
            minHeight: "44vh",
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            background: "linear-gradient(180deg, rgba(6,10,20,.98), rgba(15,23,42,.98))",
            padding: "12px 12px 18px",
            boxShadow: "0 -8px 24px rgba(2,6,23,.35)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 15 }}>Hand</div>
              <div style={{ color: "#64748b", fontWeight: 700, fontSize: 11 }}>{myPlayer.hand.length} cards</div>
            </div>
            {hasSelection ? (
              <div style={{ color: "#7dd3fc", fontWeight: 800, fontSize: 11 }}>{selectedIds.length}</div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              overflowX: "auto",
              gap: 0,
              paddingTop: 10,
              paddingBottom: 10,
              scrollbarWidth: "thin",
              touchAction: "pan-x",
              minHeight: 154,
              alignItems: "flex-end",
            }}
          >
            {orderedHand.map((c, index) => {
              const selected = selectedIds.includes(c.id);
              const recentlyDrawn = recentDrawnIds.includes(c.id);
              const isWild = c.joker || c.rank === 2;
              return (
                <button
                  key={`mobile-hand-${c.id}`}
                  type="button"
                  onClick={() => {
                    if (suppressTapRef.current) {
                      suppressTapRef.current = false;
                      return;
                    }
                    toggleSelect(c.id);
                  }}
                  style={{
                    flex: "0 0 auto",
                    width: 76,
                    height: 116,
                    marginLeft: index === 0 ? 0 : -24,
                    borderRadius: 14,
                    padding: 3,
                    background: recentlyDrawn ? "#efe8d4" : "#fffdf8",
                    border: "none",
                    transform: selected ? "translateY(-18px)" : "translateY(0)",
                    boxShadow: selected
                      ? "0 0 0 2px rgba(103,232,249,.45), 0 20px 32px rgba(2,6,23,.42)"
                      : isWild
                        ? "0 16px 24px rgba(2,6,23,.3), 0 0 0 2px rgba(250,204,21,.2)"
                        : "0 16px 24px rgba(2,6,23,.3)",
                    transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                    position: "relative",
                    zIndex: selected ? 40 + index : index,
                  }}
                >
                  {renderCardFace(c, false)}
                  {isWild ? (
                    <div
                      style={{
                        position: "absolute",
                        right: 7,
                        top: 7,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "rgba(250,204,21,.88)",
                        color: "#111827",
                        fontWeight: 900,
                        fontSize: 9,
                      }}
                    >
                      Wild
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,.28)",
        background: "linear-gradient(180deg, rgba(2,6,23,.86), rgba(2,6,23,.96))",
        padding: 10,
        display: "grid",
        gap: 8,
      }}
    >
      {!isMobile && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Din hand ({myPlayer.name})</div>
          <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Klicka för markering • Dra för ordning • Släng via slänghög</div>
        </div>
      )}
      {isMobile ? (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
          <Button
            variant={mobileSortMode ? "primary" : "ghost"}
            onClick={toggleMobileSortMode}
            disabled={!canSortHand}
            style={{ width: "auto", padding: "8px 10px", flexShrink: 0 }}
          >
            {mobileSortMode ? "Automatisk sortering" : "Sortera manuellt"}
          </Button>
        </div>
      ) : null}

      {showLandscapeHandOverview ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "4px 2px 10px",
            scrollbarWidth: "thin",
            touchAction: "pan-x",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >
          {orderedHand.map((c) => {
            const selected = selectedIds.includes(c.id);
            const recentlyDrawn = recentDrawnIds.includes(c.id);
            return (
              <button
                key={`landscape-hand-${c.id}`}
                type="button"
                onClick={() => {
                  if (suppressTapRef.current) {
                    suppressTapRef.current = false;
                    return;
                  }
                  toggleSelect(c.id);
                }}
                style={{
                  flex: "0 0 auto",
                  width: 58,
                  height: 88,
                  borderRadius: 11,
                  border: selected ? "2px solid #67e8f9" : "1px solid rgba(15,23,42,.3)",
                  background: recentlyDrawn ? "#efe8d4" : "#fffdf8",
                  padding: 3,
                  transform: selected ? "translateY(-8px)" : "translateY(0)",
                  boxShadow: selected
                    ? "0 0 0 1px rgba(103,232,249,.45), 0 12px 20px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.8)"
                    : recentlyDrawn
                    ? "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.5), inset 0 0 0 999px rgba(15,23,42,.06)"
                    : "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.78)",
                  transition: "transform .14s ease, border-color .12s ease, background .16s ease, box-shadow .16s ease",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                {renderCardFace(c, true)}
              </button>
            );
          })}
        </div>
      ) : (
        <div
          ref={handAreaRef}
          style={{
            position: "relative",
            height: handAreaHeight,
            touchAction: isMobile ? "none" : "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerMove={(e) => {
            if (!isMobile || !dragCardId || !handReorderEnabled) return;
            const resolved = resolveHandDropTarget(e.clientX);
            setHandDropSide(resolved.side);
            setHoverCardId(resolved.side ? null : resolved.targetId);
          }}
          onDragOver={(e) => {
            if (!handReorderEnabled) return;
            e.preventDefault();
            const resolved = resolveHandDropTarget(e.clientX);
            setHandDropSide(resolved.side);
            setHoverCardId(resolved.side ? null : resolved.targetId);
          }}
          onDragLeave={() => setHandDropSide(null)}
          onDrop={(e) => {
            if (!handReorderEnabled) return;
            e.preventDefault();
            const fromId = e.dataTransfer.getData("text/plain") || dragCardId;
            if (!fromId || orderedHand.length < 2) return;
            const resolved = resolveHandDropTarget(e.clientX);
            const targetId =
              resolved.side === "left"
                ? orderedHand[0]?.id
                : resolved.side === "right"
                ? orderedHand[orderedHand.length - 1]?.id
                : resolved.targetId;
            if (targetId) moveHandCard(fromId, targetId);
          }}
        >
          {dropMarkerX != null && (
            <div
              style={{
                position: "absolute",
                left: `calc(50% + ${dropMarkerX}px)`,
                bottom: 10,
                transform: "translateX(-50%)",
                width: 4,
                height: 136,
                borderRadius: 999,
                background: "linear-gradient(180deg, rgba(34,211,238,.1), rgba(34,211,238,.95), rgba(34,211,238,.1))",
                boxShadow: "0 0 16px rgba(34,211,238,.9), 0 0 26px rgba(34,211,238,.55)",
                pointerEvents: "none",
                zIndex: 2000,
              }}
            />
          )}
          {orderedHand.map((c, i) => {
            const selected = selectedIds.includes(c.id);
            const recentlyDrawn = recentDrawnIds.includes(c.id);
            const prevSelected = i > 0 && selectedIds.includes(orderedHand[i - 1]?.id);
            const nextSelected = i < orderedHand.length - 1 && selectedIds.includes(orderedHand[i + 1]?.id);
            const offset = handOffsetAt(i);
            const rot = (i - handCenter) * 0.6;
            const isHoverTarget = hoverCardId === c.id && dragCardId && dragCardId !== c.id;
            const spreadAdjust = selected ? 0 : (prevSelected ? 8 : 0) - (nextSelected ? 8 : 0);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (suppressTapRef.current) {
                    suppressTapRef.current = false;
                    return;
                  }
                  toggleSelect(c.id);
                }}
                draggable={handReorderEnabled}
                onPointerDown={(e) => {
                  if (!isMobile || !handReorderEnabled) return;
                  if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  pointerStartRef.current = { x: e.clientX, y: e.clientY };
                  pressedCardIdRef.current = c.id;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  longPressTimerRef.current = setTimeout(() => {
                    suppressTapRef.current = true;
                    setDragCardId(c.id);
                    setHoverCardId(c.id);
                    setHandDropSide(null);
                  }, 180);
                }}
                onPointerMove={(e) => {
                  if (!isMobile || !handReorderEnabled || dragCardId || pressedCardIdRef.current !== c.id) return;
                  const start = pointerStartRef.current;
                  if (!start) return;
                  const dx = e.clientX - start.x;
                  const dy = e.clientY - start.y;
                  if (Math.hypot(dx, dy) < 14) return;
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  suppressTapRef.current = true;
                  setDragCardId(c.id);
                  setHoverCardId(c.id);
                  setHandDropSide(null);
                }}
                onPointerLeave={() => {
                  if (longPressTimerRef.current && !dragCardId) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onPointerUp={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  pointerStartRef.current = null;
                  pressedCardIdRef.current = null;
                }}
                onPointerCancel={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  pointerStartRef.current = null;
                  pressedCardIdRef.current = null;
                }}
                onDragStart={(e) => {
                  setDragCardId(c.id);
                  setHoverCardId(c.id);
                  setHandDropSide(null);
                  e.dataTransfer.setData("text/plain", c.id);
                }}
                onDragEnd={() => {
                  setDragCardId(null);
                  setHoverCardId(null);
                  setHandDropSide(null);
                  suppressTapRef.current = false;
                }}
                onDragOver={(e) => {
                  if (!handReorderEnabled) return;
                  e.preventDefault();
                  if (handDropSide) setHandDropSide(null);
                  if (hoverCardId !== c.id) setHoverCardId(c.id);
                }}
                onDrop={(e) => {
                  if (!handReorderEnabled) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const fromId = e.dataTransfer.getData("text/plain") || dragCardId;
                  moveHandCard(fromId, c.id);
                }}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${offset + spreadAdjust}px)`,
                  bottom: (isMobile ? 4 : 6) + (selected ? (isMobile ? 10 : 14) : 0) + (isHoverTarget ? 4 : 0),
                  transform: `translateX(-50%) rotate(${rot}deg)`,
                  width: handCardWidth,
                  height: handCardHeight,
                  borderRadius: 11,
                  border: isMobile && dragCardId === c.id ? "2px solid #22d3ee" : isHoverTarget ? "2px solid #22d3ee" : selected ? "2px solid #67e8f9" : "1px solid rgba(15,23,42,.3)",
                  background: recentlyDrawn ? "#efe8d4" : "#fffdf8",
                  color: "#0f172a",
                  fontWeight: 900,
                  fontSize: 13,
                  zIndex: 120 + i,
                  cursor: handReorderEnabled ? "grab" : "pointer",
                  opacity: canSortHand ? 1 : 0.72,
                  boxShadow: selected
                    ? "0 0 0 1px rgba(103,232,249,.45), 0 12px 20px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.8)"
                    : recentlyDrawn
                    ? "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.5), inset 0 0 0 999px rgba(15,23,42,.06)"
                    : "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.78)",
                  padding: 3,
                  transition: "left .14s ease, bottom .14s ease, transform .14s ease, border-color .12s ease, background .16s ease, box-shadow .16s ease",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                {renderCardFace(c, false)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
