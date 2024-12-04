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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (e.target.name === "excel") {
      setFile(file);
      console.log("Excel uploaded:", file);
    } else if (e.target.name === "zip") {
      setZip(file);
      console.log("Zip uploaded:", file);
    }
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    console.log(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !zip || !name) {
      setError("Please upload all required files and/or sheet name.");
      return;
    }

    setLoading(true);

    try {
      await sortShippingLabels(file, zip, name);
    } catch (error) {
      console.error("Error sorting labels:", error);
      setError("Failed to sort labels.");
    } finally {
      console.log("Labels Sorted!");
      setLoading(false);
    }
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
          <input
            type="file"
            name="excel"
            hidden
            onChange={handleFileChange}
            accept=".xlsx"
          />
        </Button>
        <Button
          className="zip"
          component="label"
          variant="contained"
          startIcon={<CloudUploadRounded />}
        >
          Upload Zip
          <input
            type="file"
            name="zip"
            hidden
            onChange={handleFileChange}
            accept=".zip"
          />
        </Button>
        <Box className="text-box">
          <p>Enter name of sheet to reference (ex: Machine)</p>
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
        <Button
          className="submit"
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{
            "&.Mui-disabled": {
              backgroundColor: "gray",
              color: "white",
            },
          }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ color: "white" }} />
          ) : (
            "Sort Labels"
          )}
        </Button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </Box>
    </Box>
  );
}
