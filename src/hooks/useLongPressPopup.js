import useRightClickPopup from "./useRightClickPopup";
import useLongPressPopup from "./useLongPressPopup";

export default function usePopupTrigger() {
  const right = useRightClickPopup();
  const long = useLongPressPopup();

  return (menuBuilder, opts = {}) => ({
    ...right(menuBuilder, opts),
    ...long(menuBuilder, opts),
  });
}