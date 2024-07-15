import {
  Asset,
  Factory,
  MAINNET_FACTORY_ADDR,
  PoolType,
  ReadinessStatus,
} from "@dedust/sdk";

import {
  TonClient4,
  toNano,
  fromNano,
  Address,
  WalletContractV4,
  OpenedContract,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const ASSETS = {
  TON: Asset.native(),
  USDT: Asset.jetton(
    Address.parse("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs")
  ),
};

export class DeDustService {
  private readonly tonClient: TonClient4;
  private readonly factory: OpenedContract<Factory>;

  constructor() {
    this.tonClient = new TonClient4({
      endpoint: "https://mainnet-v4.tonhubapi.com",
    });

    this.factory = this.tonClient.open(
      Factory.createFromAddress(MAINNET_FACTORY_ADDR)
    );
  }

  public startTrackPairs() {
    setInterval(async () => {
      const tonToUsdt = await this.estimateSwapAmount(
        ASSETS.TON,
        ASSETS.USDT,
        1
      );
      const usdtToTon = await this.estimateSwapAmount(
        ASSETS.USDT,
        ASSETS.TON,
        1
      );

      console.log({ tonToUsdt, usdtToTon });
    }, 5000);
  }

  public async swapTonToUsdt(amountOfTon: number) {
    const mnemonic = this.convertMnemonicStringToArray(process.env.MNEMONIC);
    const keys = await mnemonicToPrivateKey(mnemonic);

    const wallet = this.tonClient.open(
      WalletContractV4.create({
        workchain: 0,
        publicKey: keys.publicKey,
      })
    );

    const sender = wallet.sender(keys.secretKey);

    await this.swapTokens(sender, ASSETS.TON, ASSETS.USDT, amountOfTon);
  }

  private async estimateSwapAmount(
    fromToken: Asset,
    toToken: Asset,
    amount: number
  ): Promise<number> {
    const pool = await this.factory.getPool(PoolType.VOLATILE, [
      fromToken,
      toToken,
    ]);

    const provider = this.tonClient.provider(pool.address);

    const { amountOut } = await pool.getEstimatedSwapOut(provider, {
      amountIn: toNano(amount),
      assetIn: fromToken,
    });

    const result = Number(fromNano(amountOut));

    if (fromToken === ASSETS.TON && toToken === ASSETS.USDT) {
      return result * 1000;
    } else if (fromToken === ASSETS.USDT && toToken === ASSETS.TON) {
      return result / 1000;
    } else {
      return result;
    }
  }

  private async swapTokens(
    sender: any,
    fromToken: Asset,
    toToken: Asset,
    amount: number
  ) {
    const tonVault = this.tonClient.open(await this.factory.getNativeVault());

    const pool = await this.factory.getPool(PoolType.VOLATILE, [
      fromToken,
      toToken,
    ]);

    const provider = this.tonClient.provider(pool.address);

    if ((await pool.getReadinessStatus(provider)) !== ReadinessStatus.READY) {
      throw new Error("Pool (TON, SCALE) does not exist.");
    }

    if ((await tonVault.getReadinessStatus()) !== ReadinessStatus.READY) {
      throw new Error("Vault (TON) does not exist.");
    }

    try {
      tonVault.sendSwap(sender, {
        poolAddress: pool.address,
        amount: toNano(amount),
        gasAmount: toNano("0.01"),
      });
    } catch (e) {
      console.log(e);
    }
  }

  private convertMnemonicStringToArray(
    mnemonicString: string | undefined
  ): string[] {
    if (!mnemonicString) {
      throw new Error("Mnemonic phrase cannot be empty.");
    }
    return mnemonicString.trim().split(/\s+/);
  }
}
