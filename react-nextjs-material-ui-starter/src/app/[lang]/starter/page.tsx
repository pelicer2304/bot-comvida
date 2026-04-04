"use client";

import * as React from "react"; 
import NextLink from 'next/link'; 
import {
  Card,
  Box,
  Typography,
  Button
} from "@mui/material";
import Link from 'next/link';
import Image from "next/image";
import { useParams } from "next/navigation";

export default function Page() {
  const { lang } = useParams();

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb-card">
        <h5>Starter</h5>

        <ul className="breadcrumb">
          <li>
            <NextLink href="/dashboard/ecommerce/">
              <i className="material-symbols-outlined">home</i>
              Dashboard
            </NextLink>
          </li>
          <li>Starter</li>
        </ul>
      </div>

      <Card
        sx={{
          boxShadow: "none",
          borderRadius: "7px",
          mb: "25px",
          paddingX: "25px",
          paddingY: { xs: '40px', sm: '60px', md: '70px', lg: '80px' },
          textAlign: 'center'
        }}
        className="rmui-card"
      >
        <Box mb="30px">
          <Image 
            src="/images/starter.png" 
            alt="starter-image" 
            width={880} 
            height={538} 
          />
        </Box>

        <Typography 
          variant="h4" 
          className="text-black"
          sx={{
            fontSize: '20px',
            fontWeight: '700',
            maxWidth: '550px',
            mb: '30px',
            mx: 'auto',
            lineHeight: '1.5'
          }}
        >
          Create something beautiful, like a masterpiece or a really good sandwich.
        </Typography>

        <Link href={`/${lang}/dashboard/ecommerce/`}>
          <Button
            type="button"
            variant="contained"
            sx={{
              textTransform: "capitalize",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: { xs: "13px", sm: "16px" },
              padding: { xs: "10px 20px", sm: "10px 24px" },
              color: "#fff !important",
              boxShadow: "none",
            }}
          >
            Getting Started
          </Button>
        </Link> 
      </Card>
    </>
  );
}
