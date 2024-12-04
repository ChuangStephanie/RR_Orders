import React from "react";
import { Route, Routes } from "react-router-dom";
import Sort from "./Components/Sort";
import Appbar from "./Components/Appbar";

export default function App() {
  return (
    <>
      <Appbar />
      <Routes>
        <Route path="/" element={<Sort />} />
      </Routes>
    </>
  );
}
