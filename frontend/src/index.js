import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ContinuousAuth from "./ContinuousAuth"; // هنا بنستورد الكومبوننت الجديد
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ContinuousAuth /> {/* هنا بنعرض الكومبوننت الجديد */}
  </React.StrictMode>
);
reportWebVitals();