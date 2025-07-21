import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const checkInitialLogin = async () => {
      try {
        const isLogged = await invoke<boolean>("check_login");
        setLoggedIn(isLogged);
        if (isLogged) {
          const prof = await invoke<string>("get_profile");
          setProfile(JSON.parse(prof));
        }
      } catch (error) {
        console.error(error);
      }
    };
    checkInitialLogin();

    const unlistenSuccess = listen("login_success", async () => {
      setLoggedIn(true);
      const prof = await invoke<string>("get_profile");
      setProfile(JSON.parse(prof));
    });

    const unlistenFailed = listen("login_failed", (e) => {
      console.error(e.payload);
      setLoggedIn(false);
      setProfile(null);
    });

    return () => {
      unlistenSuccess.then(f => f());
      unlistenFailed.then(f => f());
    };
  }, []);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  const handleLogin = async () => {
    try {
      await invoke("start_login_flow");
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      {!loggedIn ? (
        <button onClick={handleLogin}>Login with Google</button>
      ) : (
        <p>Logged in as {profile?.name}</p>
      )}

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
