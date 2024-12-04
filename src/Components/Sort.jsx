import React, { useState } from "react";
import {
  Box,
  Button,
  Snackbar,
  SnackbarContent,
  CircularProgress,
  Slide,
  TextField,
  inputLabelClasses,
} from "@mui/material";
import { CloudUploadRounded } from "@mui/icons-material";
import { sortShippingLabels } from "../API";
import "../CSS/Sort.css";

export default function Sort() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [zip, setZip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {};

  const handleSubmit = (e) => {};

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    console.log(value);
  };

  return (
    <Box className="sort-container">
      <h1 className="title">Sort Labels</h1>
      <p>Select button to upload files</p>
      <Box className="uploads">
        <Button
          className="excel"
          component="label"
          variant="contained"
          startIcon={<CloudUploadRounded />}
        >
          Upload Excel
        </Button>
        <Button
          className="excel"
          component="label"
          variant="contained"
          startIcon={<CloudUploadRounded />}
        >
          Upload Zip
        </Button>
        <Box className="text-box">
            <p>Enter name of sheet for reference (ex: Machine)</p>
          <TextField
            className="sheetname"
            label="Sheet Name"
            variant="filled"
            size="small"
            value={name}
            onChange={handleNameChange}
            slotProps={{
              inputLabel: {
                sx: {
                  color: "white",
                  [`&.${inputLabelClasses.shrink}`]: {
                    color: "primary.light",
                  },
                },
              },
            }}
            sx={{
              "& .MuiInputBase-root": {
                backgroundColor: "#01579b",
              },
              "& .MuiInputBase-input": {
                color: "white",
              },
            }}
          ></TextField>
        </Box>
      </Box>
    </Box>
  );
}
