import { DeDustService } from "./ton";

class Main {
  public bootstrap() {
    const dedust = new DeDustService();
    dedust.startTrackPairs();
  }
}

new Main().bootstrap();
