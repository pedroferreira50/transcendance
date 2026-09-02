import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";

function App() {
    const [page, setPage] = useState<"login" | "register">("login");

    if (page === "login") {
        return (
            <Login
                onRegister={() => setPage("register")}
            />
        );
    }

    return (
        <Register
            onLogin={() => setPage("login")}
        />
    );
}

export default App;