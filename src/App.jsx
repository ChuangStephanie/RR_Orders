import React from "react";
import { Route, Routes } from "react-router-dom";
import Sort from "./Components/Sort";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Sort />} />
      </Routes>
    </>
  );
}
