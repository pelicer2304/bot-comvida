"use client";

import * as React from "react";
import { Grid, Box, Typography } from "@mui/material";
import Image from "next/image";

const testimonials = [
  {
    id: 1,
    name: "Sarah Thompson",
    role: "Data Analyst",
    image: "/images/front-pages/user1.jpg",
    rating: 5,
    review:
      "Trezo Dashboard Template has transformed how we manage our data. Its intuitive design and customizable features have streamlined our analytics process, enabling us to make informed decisions faster than ever before.",
  },
  {
    id: 2,
    name: "John Smith",
    role: "Software Engineer",
    image: "/images/front-pages/user2.jpg",
    rating: 4.5,
    review:
      "As a developer, I appreciate the flexibility and robustness of Trezo Dashboard Template. It offers a wide range of features that cater to our diverse needs, and its clean codebase has made customization a breeze. Highly recommended!",
  },
  {
    id: 3,
    name: "Alex Rodriguez",
    role: "Marketing Director",
    image: "/images/front-pages/user3.jpg",
    rating: 4,
    review:
      "Trezo Dashboard Template has been a lifesaver for our organization. It's helped us streamline our reporting processes and communicate insights effectively across departments. The time saved has allowed us to focus more on strategic initiatives.",
  },
  {
    id: 4,
    name: "Kevin Brown",
    role: "Business Analyst",
    image: "/images/front-pages/user4.jpg",
    rating: 3.5,
    review:
      "I can't recommend the Trezo Template enough. It's helped us gain a deeper understanding of our business metrics and identify areas for improvement. The responsive support team is a bonus, always ready to assist whenever needed.",
  },
  {
    id: 5,
    name: "Olivia Adams",
    role: "Marketing Coordinator",
    image: "/images/front-pages/user5.jpg",
    rating: 5,
    review:
      "Using Trezo Dashboard Template has been a game-changer for our team. The ability to customize widgets to suit our specific needs has allowed us to gain deeper insights into our performance metrics and drive business growth.",
  },
  {
    id: 6,
    name: "Daniel Lee",
    role: "Co-founder, StartupX",
    image: "/images/front-pages/user6.jpg",
    rating: 3,
    review:
      "As a startup, we needed a dashboard solution that was both powerful and cost-effective. Trezo Dashboard Template checked all the boxes for us. It's helped us stay agile and competitive in a fast-paced market.",
  },
];

// Function to generate star rating icons dynamically
const generateStars = (rating: number) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
    <>
      {[...Array(fullStars)].map((_, i) => (
        <i key={`full-${i}`} className="ri-star-fill"></i>
      ))}
      {halfStar && <i className="ri-star-half-fill"></i>}
      {[...Array(emptyStars)].map((_, i) => (
        <i key={`empty-${i}`} className="ri-star-line"></i>
      ))}
    </>
  );
};

const Testimonials: React.FC = () => {
  return (
    <>
      <Box
        sx={{
          pb: { xs: "60px", sm: "70px", md: "80px", lg: "100px", xl: "120px" },
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
          <div className="section-title text-center">
            <div className="sub-title">
              <span className="text-purple">Testimonials</span>
            </div>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "24px", md: "28px", lg: "34px", xl: "36px" },
              }}
            >
              Inspiring Feedback: What Users Love About Trezo Dashboard
            </Typography>
          </div>

          <Grid
            container
            alignItems="center"
            columnSpacing={{ xs: 1, sm: 2, md: 2, lg: 3 }}
          >
            {testimonials.map((testimonial) => (
              <Grid
                size={{ xs: 12, sm: 12, md: 6, lg: 4, xl: 4 }}
                key={testimonial.id}
              >
                <div className="fp-single-testimonial-item bg-white border-radius">
                  <div className="ratings">
                    {generateStars(testimonial.rating)}
                  </div>

                  <p>{testimonial.review}</p>

                  <div className="info">
                    <Image
                      src={testimonial.image}
                      className="rounded-circle"
                      alt={testimonial.name}
                      width={50}
                      height={50}
                    />
                    <div>
                      <h5>{testimonial.name}</h5>
                      <span>{testimonial.role}</span>
                    </div>
                  </div>
                </div>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </>
  );
};

export default Testimonials;
