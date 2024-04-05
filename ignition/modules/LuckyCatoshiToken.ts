import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LuckyCatoshiTokenModule = buildModule("LockModule", (m) => {
  const _devWallet = "";
  const _marketWallet = "";
  const devWallet = m.getParameter("devWallet", _devWallet);
  const marketWallet = m.getParameter("marketWallet", _marketWallet);

  const catoshi = m.contract("LuckyCatoshiToken", [marketWallet, devWallet]);

  return { catoshi };
});

export default LuckyCatoshiTokenModule;
