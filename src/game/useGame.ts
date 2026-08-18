import { useEffect, useReducer } from "react";
import { AppState } from "react-native";
import { GameController } from "./controller";

const controller = new GameController();

/** Subscribe React to the headless controller without duplicating state into component hooks. */
export function useGame() {
  const [, refresh] = useReducer((version) => version + 1, 0);
  useEffect(() => {
    const unsubscribe = controller.subscribe(refresh);
    return () => { unsubscribe(); };
  }, []);
  useEffect(() => {
    void controller.initialize();
    const subscription = AppState.addEventListener("change", (state) => controller.setPaused(state !== "active"));
    return () => subscription.remove();
  }, []);
  return { controller, view: controller.getView() };
}
