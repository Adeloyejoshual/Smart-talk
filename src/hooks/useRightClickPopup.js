import { usePopup } from "../context/PopupContext";

export default function useRightClickPopup() {
  const { showPopup, hidePopup } = usePopup();
  return (menuBuilder, opts = {}) => ({
    onContextMenu: (e) => {
      e.preventDefault();
      const rect = e.target.getBoundingClientRect();
      showPopup(menuBuilder(), { x: e.clientX, y: e.clientY, anchorRect: rect, ...opts });
    },
    onClick: hidePopup,
  });
}