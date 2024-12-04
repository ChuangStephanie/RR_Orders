import React, { useState } from "react";
import sortShippingLabels from "../API";

export default function Sort() {
    const [file, setFile] = useState(null);
    const [name, setName] = useState("");
    const [zip, setZip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    const handleFileChange = (e) => {}

    return (
        <h1>Sort Shipping Labels</h1>
    )
}