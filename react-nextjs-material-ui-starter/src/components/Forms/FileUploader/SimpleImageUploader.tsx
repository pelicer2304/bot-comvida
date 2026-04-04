"use client";

import React, { useState, ChangeEvent } from "react";
import { Card, Box, Typography, Button } from "@mui/material";
import Image from "next/image";

const SimpleImageUploader: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Validate file types and size (e.g., max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    const validTypes = ["image/jpeg", "image/png", "image/gif"];

    const newImages: string[] = [];
    let hasError = false;

    Array.from(files).forEach((file) => {
      if (!validTypes.includes(file.type)) {
        setError("Only JPEG, PNG, and GIF files are allowed");
        hasError = true;
        return;
      }
      if (file.size > maxSize) {
        setError("File size must be less than 5MB");
        hasError = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === "string") {
          newImages.push(reader.result);
          setImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (!hasError) setError("");
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card
      sx={{
        boxShadow: "none",
        borderRadius: "7px",
        mb: "25px",
        padding: { xs: "18px", sm: "20px", lg: "25px" },
      }}
      className="rmui-card"
    >
      <Box sx={{ mb: "25px" }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: { xs: "16px", md: "18px" },
            fontWeight: 700,
          }}
          className="text-black"
        >
          Simple Image Uploader
        </Typography>
      </Box>

      <Box component="form">
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif"
          onChange={handleImageUpload}
          className="border"
          style={{
            width: "100%",
            padding: "20px",
            cursor: "pointer",
          }}
        />

        {error && (
          <Typography color="error" sx={{ mt: "10px" }}>
            {error}
          </Typography>
        )}

        <Box
          sx={{
            mt: "15px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {images.map((image, index) => (
            <Box key={index} sx={{ position: "relative" }}>
              <Image
                src={image}
                alt={`uploaded-${index}`}
                width={60}
                height={60}
                style={{
                  borderRadius: "7px",
                  objectFit: "cover",
                }}
              />
              <Button
                size="small"
                color="error"
                onClick={() => removeImage(index)}
                sx={{
                  position: "absolute",
                  top: -10,
                  right: -10, 
                  background: "white",
                  borderRadius: "50%",
                  p: 0,
                  width: "20px",
                  height: "20px",
                  minWidth: "20px",
                  fontSize: "15px",
                }}
              >
                ×
              </Button>
            </Box>
          ))}
        </Box>
      </Box>
    </Card>
  );
};

export default SimpleImageUploader;