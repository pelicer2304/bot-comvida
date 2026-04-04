"use client";

import * as React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { Box, Typography } from "@mui/material";
import Image from "next/image";

const teamMembers = [
  {
    id: 1,
    name: "Michael Johnson",
    role: "CEO",
    image: "/images/front-pages/team1.jpg",
    socials: [
      {
        id: 1,
        icon: "ri-facebook-fill",
        link: "https://www.facebook.com/",
      },
      {
        id: 2,
        icon: "ri-twitter-fill",
        link: "https://www.twitter.com/",
      },
      {
        id: 3,
        icon: "ri-linkedin-fill",
        link: "https://www.linkedin.com/",
      },
    ],
  },
  {
    id: 2,
    name: "Emily Davis",
    role: "Project Manager",
    image: "/images/front-pages/team2.jpg",
    socials: [
      {
        id: 1,
        icon: "ri-facebook-fill",
        link: "https://www.facebook.com/",
      },
      {
        id: 2,
        icon: "ri-twitter-fill",
        link: "https://www.twitter.com/",
      },
      {
        id: 3,
        icon: "ri-linkedin-fill",
        link: "https://www.linkedin.com/",
      },
    ],
  },
  {
    id: 3,
    name: "Daniel Lee",
    role: "Sales Team Lead",
    image: "/images/front-pages/team3.jpg",
    socials: [
      {
        id: 1,
        icon: "ri-facebook-fill",
        link: "https://www.facebook.com/",
      },
      {
        id: 2,
        icon: "ri-twitter-fill",
        link: "https://www.twitter.com/",
      },
      {
        id: 3,
        icon: "ri-linkedin-fill",
        link: "https://www.linkedin.com/",
      },
    ],
  },
  {
    id: 4,
    name: "Olivia John",
    role: "Frontend Lead",
    image: "/images/front-pages/team4.jpg",
    socials: [
      {
        id: 1,
        icon: "ri-facebook-fill",
        link: "https://www.facebook.com/",
      },
      {
        id: 2,
        icon: "ri-twitter-fill",
        link: "https://www.twitter.com/",
      },
      {
        id: 3,
        icon: "ri-linkedin-fill",
        link: "https://www.linkedin.com/",
      },
    ],
  },
];

const OurTeam: React.FC = () => {
  return (
    <>
      <Box
        className="fp-team-area"
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
          <div className="section-title text-center">
            <div className="sub-title">
              <span className="text-purple">Our Team</span>
            </div>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "24px", md: "28px", lg: "34px", xl: "36px" },
              }}
            >
              Introducing Our Exceptional Team. Meet the Minds Driving Our
              Success
            </Typography>
          </div>

          <Swiper
            spaceBetween={25}
            pagination={{
              clickable: true,
            }}
            breakpoints={{
              0: {
                slidesPerView: 1,
              },
              540: {
                slidesPerView: 2,
              },
              1200: {
                slidesPerView: 3,
              },
            }}
            modules={[Pagination]}
            className="fp-team-slides"
          >
            {teamMembers.map((member) => (
              <SwiperSlide key={member.id}>
                <div className="fp-single-team-member">
                  <div className="image border-radius">
                    <Image
                      src={member.image}
                      className="border-radius"
                      alt={member.name}
                      width={570}
                      height={570}
                    />
                  </div>

                  <div className="content border-radius">
                    <div>
                      <h3>{member.name}</h3>
                      <span className="d-block">{member.role}</span>
                    </div>

                    <div className="socials">
                      {member.socials.map((social) => (
                        <a key={social.id} href={social.link} target="_blank">
                          <i className={social.icon}></i>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

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

export default OurTeam;
