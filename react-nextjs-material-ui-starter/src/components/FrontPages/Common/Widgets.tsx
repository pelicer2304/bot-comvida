"use client";

import * as React from "react";
import { Grid, Box } from "@mui/material";
import Image from "next/image";

const widgetFeatures = [
  {
    id: 1,
    title: "Tailored Display",
    description:
      "Easily arrange, resize, and configure widgets to showcase the data most relevant to your workflow.",
  },
  {
    id: 2,
    title: "Personalized Insights",
    description:
      "Customize widget content and visualization options to match your specific preferences and priorities.",
  },
  {
    id: 3,
    title: "Flexibility and Versatility",
    description:
      "Adapt widgets to evolving business needs by adjusting layouts, styles, and data sources with ease.",
  },
  {
    id: 4,
    title: "Seamless Integration",
    description:
      "Integrate widgets seamlessly with other dashboard components and external systems for a cohesive user experience.",
  },
];

const Widgets: React.FC = () => {
  return (
    <>
      <Box
        className="fp-widgets-area"
        sx={{
          pb: { xs: "60px", sm: "60px", md: "80px", lg: "100px", xl: "150px" },
        }}
      >
        <Box
          sx={{
            maxWidth: {
              xs: "100%",
              sm: "700px",
              md: "720px",
              lg: "1140px",
              xl: "1320px",
            },
            mx: "auto",
            px: "12px",
            position: "relative",
            zIndex: "1",
          }}
        >
          <Grid
            container
            alignItems="center"
            columnSpacing={{ xs: 1, sm: 2, md: 2, lg: 3 }}
          >
            <Grid size={{ xs: 12, sm: 12, md: 12, lg: 6, xl: 6 }}>
              <div className="fp-widgets-image">
                <div className="image">
                  <Image
                    src="/images/front-pages/order-summary.png"
                    alt="order-summary-image"
                    width={662}
                    height={807}
                  />
                </div>
                <div className="image2">
                  <Image
                    src="/images/front-pages/courses-sales.jpg"
                    alt="courses-sales-image"
                    width={330}
                    height={295}
                  />
                </div>
              </div>
            </Grid>

            <Grid size={{ xs: 12, sm: 12, md: 12, lg: 6, xl: 6 }}>
              <div className="fp-widgets-content">
                <h2>
                  Tailor Your Dashboard: Unleash the Power of Customizable
                  Widgets
                </h2>

                <ul className="features-list">
                  {widgetFeatures.map((feature) => (
                    <li key={feature.id}>
                      <i className="material-symbols-outlined">done_outline</i>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Grid>
          </Grid>

          {/* Shape Images */}
          <div className="shape1">
            <Image
              src="/images/front-pages/shape1.png"
              alt="shape1"
              width={530}
              height={530}
            />
          </div>
          <div className="shape2">
            <Image
              src="/images/front-pages/shape2.png"
              alt="shape2"
              width={447}
              height={453}
            />
          </div>
        </Box>
      </Box>
    </>
  );
};

export default Widgets;
