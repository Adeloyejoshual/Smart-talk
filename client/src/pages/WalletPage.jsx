import React from "react";
import axios from "axios";
import { auth } from "../firebaseClient";

export default function WalletPage(){
  const [wallet,setWallet] = React.useState({ balance: 0 });
  const [amount,setAmount] = React.useState(5);
  const API = import.meta.env.VITE_API_URL || "/api";

  React.useEffect(() => {
    async function load() {
      const uid = auth.currentUser.uid;
      const r = await axios.get(`${API}/wallet/${uid}`);
      setWallet(r.data.wallet || { balance: 0 });
    }
    if (auth.currentUser) load();
  }, [auth.currentUser]);

  const addCreditStripe = async () => {
    const uid = auth.currentUser.uid;
    const r = await axios.post(`${API}/payment/stripe-session`, { amount, uid });
    window.location.href = r.data.url;
  };

  const sendPopup = async () => {
    const to = prompt("Recipient UID:");
    const amt = Number(prompt("Amount USD:"));
    if (!to || !amt) return alert("Cancelled");
    try {
      const r = await axios.post(`${API}/wallet/send`, { fromUid: auth.currentUser.uid, toUid: to, amount: amt });
      alert("Sent!");
      setWallet(r.data.from);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const withdraw = () => {
    alert("Withdraw coming soon 🚀");
  };

  return (
    <div style={{maxWidth:900,margin:"20px auto"}}>
      <h3>Wallet</h3>
      <div style={{padding:12,border:"1px solid #eee",borderRadius:8,display:"flex",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:24}}>${(wallet.balance||0).toFixed(2)}</div>
          <div style={{fontSize:12,color:"#666"}}>Expires in 3 months (bonus)</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={addCreditStripe}>Add Credit</button>
          <button onClick={sendPopup}>Send</button>
          <button onClick={withdraw}>Withdraw</button>
        </div>
      </div>
    </div>
  );
}
