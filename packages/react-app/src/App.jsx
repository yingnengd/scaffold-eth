import WalletConnectProvider from "@walletconnect/web3-provider";
//import Torus from "@toruslabs/torus-embed"
import WalletLink from "walletlink";
import { Alert, Button, Card, Col, Menu, Row, List, Input } from "antd";
import "antd/dist/antd.css";
import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import Web3Modal from "web3modal";
import "./App.css";
import { Account, Contract, Faucet, GasGauge, Header, Ramp, ThemeSwitch } from "./components";
import { INFURA_ID, NETWORK, NETWORKS } from "./constants";
import { Transactor } from "./helpers";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useEventListener } from "eth-hooks/events/useEventListener";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
// import Hints from "./Hints";
import { ExampleUI, Hints, Subgraph } from "./views";

// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import externalContracts from "./contracts/external_contracts";

import { useContractConfig } from "./hooks";
import Portis from "@portis/web3";
import Fortmatic from "fortmatic";
import Authereum from "authereum";

const { ethers } = require("ethers");
/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/scaffold-eth/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/

/// 📡 What chain are your contracts deployed to?
const targetNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
const NETWORKCHECK = true;

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://rpc.scaffoldeth.io:48544")
  : null;
const poktMainnetProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider(
      "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
    )
  : null;
const mainnetInfura = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID)
  : null;
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_ID
// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

// Coinbase walletLink init
const walletLink = new WalletLink({
  appName: "coinbase",
});

// WalletLink provider
const walletLinkProvider = walletLink.makeWeb3Provider(`https://mainnet.infura.io/v3/${INFURA_ID}`, 1);

// Portis ID: 6255fb2b-58c8-433b-a2c9-62098c05ddc9
/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  network: "mainnet", // Optional. If using WalletConnect on xDai, change network to "xdai" and add RPC info below for xDai chain.
  cacheProvider: true, // optional
  theme: "light", // optional. Change to "dark" for a dark theme.
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        bridge: "https://polygon.bridge.walletconnect.org",
        infuraId: INFURA_ID,
        rpc: {
          1: `https://mainnet.infura.io/v3/${INFURA_ID}`, // mainnet // For more WalletConnect providers: https://docs.walletconnect.org/quick-start/dapps/web3-provider#required
          42: `https://kovan.infura.io/v3/${INFURA_ID}`,
          100: "https://dai.poa.network", // xDai
        },
      },
    },
    portis: {
      display: {
        logo: "https://user-images.githubusercontent.com/9419140/128913641-d025bc0c-e059-42de-a57b-422f196867ce.png",
        name: "Portis",
        description: "Connect to Portis App",
      },
      package: Portis,
      options: {
        id: "6255fb2b-58c8-433b-a2c9-62098c05ddc9",
      },
    },
    fortmatic: {
      package: Fortmatic, // required
      options: {
        key: "pk_live_5A7C91B2FC585A17", // required
      },
    },
    // torus: {
    //   package: Torus,
    //   options: {
    //     networkParams: {
    //       host: "https://localhost:8545", // optional
    //       chainId: 1337, // optional
    //       networkId: 1337 // optional
    //     },
    //     config: {
    //       buildEnv: "development" // optional
    //     },
    //   },
    // },
    "custom-walletlink": {
      display: {
        logo: "https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0",
        name: "Coinbase",
        description: "Connect to Coinbase Wallet (not Coinbase App)",
      },
      package: walletLinkProvider,
      connector: async (provider, _options) => {
        await provider.enable();
        return provider;
      },
    },
    authereum: {
      package: Authereum, // required
    },
  },
});

function App(props) {
  const mainnetProvider =
    poktMainnetProvider && poktMainnetProvider._isProvider
      ? poktMainnetProvider
      : scaffoldEthProvider && scaffoldEthProvider._network
      ? scaffoldEthProvider
      : mainnetInfura;

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  // keep track of a variable from the contract in the local React state:
  const purpose = useContractReader(readContracts, "YourContract", "purpose");

  // 📟 Listen for broadcast events
  const setPurposeEvents = useEventListener(readContracts, "YourContract", "SetPurpose", localProvider, 1);

  const balance = useContractReader(readContracts, "YourCollectible", "balanceOf", [address]);

  const stakedAmount = useContractReader(readContracts, "SilentAuction", "getStakeAmount", [address]);

  const [amountToStake, setAmountToStake] = useState(null);

  const [bids, setBids] = useState([]);
  useOnBlock(mainnetProvider, () => {
    const getBids = async () => {
      if (!auction) {
        return;
      }

      try {
        const data = await fetch(`http://localhost:8001/?tokenId=${auction.id._hex}`).then(res => res.json());
        console.log(data);

        const temp = [];
        const auctionBids = data[auction.id._hex];
        if (!auctionBids) {
          return;
        }

        Object.keys(auctionBids).forEach(key => {
          temp.push(auctionBids[key]);
        });
        setBids(temp);
        console.log('bids:', bids);
      } catch (e) {
        console.log(e);
        setBids({});
      }
    };

    getBids();
  });

  const [auction, setAuction] = useState("");
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    const getOwner = async () => {
      const owner = await readContracts.SilentAuction?.owner();
      setOwner(owner === address);
    }
    getOwner();
  }, [address, balance]);

  const [currentAuction, setCurrentAuction] = useState();
  const [auctionEnded, setAuctionEnded] = useState(false);

  useEffect(() => {
    const getAuction = async () => {
      const auction = await readContracts.SilentAuction?.currentAuction();
      setCurrentAuction(auction);
      const endTime = new Date(auction?.endTime * 1000);
      setAuctionEnded(endTime < Date.now());
      console.log('ended', auctionEnded);
    }
    getAuction();
  }, [address, balance]);

  useEffect(() => {
    const getAuctionView = async () => {
      if (owner) {
        return;
      }

      const auction = await readContracts.SilentAuction?.currentAuction();
      console.log(auction);
      if (auction?.inProgress) {
        const tokenURI = await readContracts.YourCollectible.tokenURI(auction.tokenId);
        const jsonManifestString = Buffer.from(tokenURI.substring(29), 'base64');
        try {
          const jsonManifest = JSON.parse(jsonManifestString);
          console.log("jsonManifest", jsonManifest);
          setAuction({ id: auction.tokenId, uri: tokenURI, owner: address, ...jsonManifest });
        } catch (e) {
          console.log(e);
        }
      }
    }
    getAuctionView();
  }, [address, balance])

  const signData = async (tokenId, amount) => {
    const bidAmount = ethers.utils.parseEther(amount);
    let hash = await ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'uint256'],
      [tokenId, address, bidAmount]
    );
    const signature = await userProviderAndSigner.provider.send('personal_sign', [hash, address]);
    console.log('signature', signature);

    await fetch('http://localhost:8001/', {
      method: 'POST',
      mode: "cors",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tokenId,
        signature,
        bidder: address,
        bidAmount
      })
    });
  }

  const [amountToBid, setAmountToBid] = useState(null);

  let auctionView = "";
  if (!owner && auction?.id) {
    auctionView = (
      <>
      <h1>BUY ME YO</h1>
        <Card style={{width: '200px', heigth: '200px'}}>
          <List.Item key={auction.uri}>
            <img src={auction.image} />
          </List.Item>
        </Card>
        <Input value={amountToBid} onChange={e => setAmountToBid(e.target.value)} />
        <Button
          onClick={() => signData(auction.id, amountToBid)}
        >
          Bid!
        </Button>
      </>
    );
  } else if(owner && auction?.id) {
    auctionView = (
      <>
        <List
          bordered
          dataSource={bids}
            renderItem={bid => {
              return (
                <Button
                  onClick={() => {
                    tx(writeContracts.SilentAuction.completeAuction(readContracts.YourCollectible.address, bid.tokenId, bid.bidder, bid.bidAmount, bid.signature))
                  }}
                >Accept!</Button>
              )
            }
          }
        >

        </List>
      </>
    );
  }

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
  ]);

  let networkDisplay = "";
  if (NETWORKCHECK && localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <Button
                  onClick={async () => {
                    const ethereum = window.ethereum;
                    const data = [
                      {
                        chainId: "0x" + targetNetwork.chainId.toString(16),
                        chainName: targetNetwork.name,
                        nativeCurrency: targetNetwork.nativeCurrency,
                        rpcUrls: [targetNetwork.rpcUrl],
                        blockExplorerUrls: [targetNetwork.blockExplorer],
                      },
                    ];
                    console.log("data", data);

                    let switchTx;
                    // https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods
                    try {
                      switchTx = await ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: data[0].chainId }],
                      });
                    } catch (switchError) {
                      // not checking specific error code, because maybe we're not using MetaMask
                      try {
                        switchTx = await ethereum.request({
                          method: "wallet_addEthereumChain",
                          params: data,
                        });
                      } catch (addError) {
                        // handle "add" error
                      }
                    }

                    if (switchTx) {
                      console.log(switchTx);
                    }
                  }}
                >
                  <b>{networkLocal && networkLocal.name}</b>
                </Button>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    networkDisplay = (
      <div style={{ zIndex: -1, position: "absolute", right: 154, top: 28, padding: 16, color: targetNetwork.color }}>
        {targetNetwork.name}
      </div>
    );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId === 31337 &&
    yourLocalBalance &&
    ethers.utils.formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: ethers.utils.parseEther("0.01"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header />
      {networkDisplay}
      <BrowserRouter>
        <Menu style={{ textAlign: "center" }} selectedKeys={[route]} mode="horizontal">
          <Menu.Item key="/">
            <Link
              onClick={() => {
                setRoute("/");
              }}
              to="/"
            >
              YourContract
            </Link>
          </Menu.Item>
          <Menu.Item key="/auction">
            <Link
              onClick={() => {
                setRoute("/auction");
              }}
              to="/auction"
            >
              Auction
            </Link>
          </Menu.Item>
          <Menu.Item key="/hints">
            <Link
              onClick={() => {
                setRoute("/hints");
              }}
              to="/hints"
            >
              Hints
            </Link>
          </Menu.Item>
          <Menu.Item key="/exampleui">
            <Link
              onClick={() => {
                setRoute("/exampleui");
              }}
              to="/exampleui"
            >
              ExampleUI
            </Link>
          </Menu.Item>
          <Menu.Item key="/mainnetdai">
            <Link
              onClick={() => {
                setRoute("/mainnetdai");
              }}
              to="/mainnetdai"
            >
              Mainnet DAI
            </Link>
          </Menu.Item>
          <Menu.Item key="/subgraph">
            <Link
              onClick={() => {
                setRoute("/subgraph");
              }}
              to="/subgraph"
            >
              Subgraph
            </Link>
          </Menu.Item>
        </Menu>

        <Switch>
          <Route exact path="/">
            {/*
                🎛 this scaffolding is full of commonly used components
                this <Contract/> component will automatically parse your ABI
                and give you a form to interact with it locally
            */}
            <h3>Staked Amount: {ethers.utils.formatEther(stakedAmount ?? 0)}</h3>
            <Input
              style={{ textAlign: "center" }}
              placeholder={"Amount of ETH to stake"}
              value={amountToStake}
              onChange={e => setAmountToStake(e.target.value)}
            />
            <Button
              type="primary"
              onClick={() => {
                tx(writeContracts.SilentAuction.stake({value: ethers.utils.parseEther(amountToStake)}));
              }}
            >Stake
            </Button>

            {auctionView}

            <div style={{display: 'flex', flexDirection: 'column'}}>
              <MintedItems
                address={address}
                mainnetProvider={mainnetProvider}
                writeContracts={writeContracts}
                readContracts={readContracts}
                tx={tx}
              ></MintedItems>
            </div>

            <Button
              type="primary"
              onClick={() => {
                tx(writeContracts.YourCollectible.mintItem())
              }}
              >Mint</Button>
            <Button
              type="primary"
              onClick={() => {
                tx(writeContracts.SilentAuction.createAuction(readContracts.YourCollectible.address, 1))
              }}
              >Start Auction</Button>
            <Contract
              name="YourContract"
              signer={userSigner}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              contractConfig={contractConfig}
            />
            <Contract
              name="SilentAuction"
              signer={userSigner}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              contractConfig={contractConfig}
            />
            <Contract
              name="YourCollectible"
              signer={userSigner}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              contractConfig={contractConfig}
            />
          </Route>
          <Route path="/auction">
            <Auction
              address={address}
              mainnetProvider={mainnetProvider}
              writeContracts={writeContracts}
              readContracts={readContracts}
              tx={tx}
            ></Auction>
          </Route>
          <Route path="/hints">
            <Hints
              address={address}
              yourLocalBalance={yourLocalBalance}
              mainnetProvider={mainnetProvider}
              price={price}
            />
          </Route>
          <Route path="/exampleui">
            <ExampleUI
              address={address}
              userSigner={userSigner}
              mainnetProvider={mainnetProvider}
              localProvider={localProvider}
              yourLocalBalance={yourLocalBalance}
              price={price}
              tx={tx}
              writeContracts={writeContracts}
              readContracts={readContracts}
              purpose={purpose}
              setPurposeEvents={setPurposeEvents}
            />
          </Route>
          <Route path="/mainnetdai">
            <Contract
              name="DAI"
              customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.DAI}
              signer={userSigner}
              provider={mainnetProvider}
              address={address}
              blockExplorer="https://etherscan.io/"
              contractConfig={contractConfig}
              chainId={1}
            />
            {/*
            <Contract
              name="UNI"
              customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.UNI}
              signer={userSigner}
              provider={mainnetProvider}
              address={address}
              blockExplorer="https://etherscan.io/"
            />
            */}
          </Route>
          <Route path="/subgraph">
            <Subgraph
              subgraphUri={props.subgraphUri}
              tx={tx}
              writeContracts={writeContracts}
              mainnetProvider={mainnetProvider}
            />
          </Route>
        </Switch>
      </BrowserRouter>

      <ThemeSwitch />

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{ position: "fixed", textAlign: "right", right: 0, top: 0, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userSigner={userSigner}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div>

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

function MintedItems(props) {
  const [mintedItems, setMintedItems] = useState([]);
  const theBalance = useContractReader(props.readContracts, "YourCollectible", "balanceOf", [props.address]);

  useOnBlock(props.mainnetProvider, () => {
    const getItems = async() => {
      const items = [];
      for (let tokenIndex = 0; tokenIndex < theBalance; tokenIndex++) {
        const tokenId = await props.readContracts.YourCollectible.tokenOfOwnerByIndex(props.address, tokenIndex);
        const tokenURI = await props.readContracts.YourCollectible.tokenURI(tokenId);
        const jsonManifestString = Buffer.from(tokenURI.substring(29), 'base64');

        try {
          const jsonManifest = JSON.parse(jsonManifestString);
          console.log("jsonManifest", jsonManifest);
          items.push({ id: tokenId, uri: tokenURI, owner: props.address, ...jsonManifest });
        } catch (e) {
          console.log(e);
        }
      }
      setMintedItems(items);
    }
    getItems();
  });

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <List
        style={{width: '400px'}}
        bordered
        dataSource={mintedItems}
        renderItem={item => {
          return (
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <Card style={{width: '400px', heigth: '200px'}}>
                <List.Item key={item.uri}>
                  <img src={item.image} />
                </List.Item>
                <Button
                  style={{ marginTop: '24px' }}
                  type="primary"
                  onClick={async () => {
                    await props.tx(props.writeContracts.YourCollectible.approve(props.readContracts.SilentAuction.address, item.id));
                    props.tx(props.writeContracts.SilentAuction.createAuction(props.readContracts.YourCollectible.address, item.id))
                  }}
                >
                  Approve transfer and start auction
                </Button>
              </Card>
            </div>
          )
        }}
        >
      </List>
      <Button
        type="primary"
        onClick={() => {
          props.tx(props.writeContracts.YourCollectible.mintItem())
        }}
      >Mint!</Button>
    </div>
  )
}

function Auction(props) {
  const [amountToBid, setAmountToBid] = useState(null);
  const [auction, setAuction] = useState(null);
  const [auctionEnded, setAuctionEnded] = useState(false);

  useOnBlock(props.mainnetProvider, () => {
    const getAuction = async () => {
      const auction = await props.readContracts.SilentAuction?.currentAuction();

      const endTime = new Date(auction?.endTime * 1000);
      setAuctionEnded(endTime < Date.now());

      if (!auctionEnded) {
        const tokenURI = await props.readContracts.YourCollectible.tokenURI(auction.tokenId);
        const jsonManifestString = Buffer.from(tokenURI.substring(29), 'base64');
        try {
          const jsonManifest = JSON.parse(jsonManifestString);
          console.log("jsonManifest", jsonManifest);
          setAuction({ id: auction.tokenId, uri: tokenURI, owner: props.address, ...jsonManifest });
        } catch (e) {
          console.log(e);
        }
      }
    }
    getAuction();
  })

  let auctionView = "";
  if (auctionEnded) {
    auctionView = (
      <div>
        <h2>Auction ended!</h2>
      </div>
    );
  } else if (auction) {
    auctionView = (
      <>
        <Card style={{width: '400px', heigth: '200px'}}>
          <List.Item key={auction.uri}>
            <img src={auction.image} />
          </List.Item>
        </Card>
        <div style={{margin: '10px'}}>
          <Input style={{width: '100px'}} value={amountToBid} onChange={e => setAmountToBid(e.target.value)} />
          <Button
            type="primary"
            onClick={() => signData(auction.id, amountToBid)}
          >
            Bid!
          </Button>
        </div>
      </>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      {auctionView}
    </div>
  );
}

export default App;
