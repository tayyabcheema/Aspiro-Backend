const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Course = require('../models/Course');

// Load environment variables
dotenv.config();

const sampleCourses = [
  {
    title: "Introduction to Web Development",
    category: "Programming",
    durationWeeks: 6,
    instructor: "Sarah Johnson",
    students: 1250,
    status: "active",
    price: 199,
    description: "Learn the fundamentals of HTML, CSS, and JavaScript to build responsive websites from scratch."
  },
  {
    title: "Python for Data Science",
    category: "Data Science",
    durationWeeks: 8,
    instructor: "Dr. Michael Chen",
    students: 890,
    status: "active",
    price: 299,
    description: "Master Python programming for data analysis, visualization, and machine learning applications."
  },
  {
    title: "UI/UX Design Fundamentals",
    category: "Design",
    durationWeeks: 4,
    instructor: "Emma Rodriguez",
    students: 650,
    status: "active",
    price: 149,
    description: "Learn user interface and user experience design principles, prototyping, and design tools."
  },
  {
    title: "Digital Marketing Strategy",
    category: "Marketing",
    durationWeeks: 5,
    instructor: "James Wilson",
    students: 720,
    status: "active",
    price: 179,
    description: "Develop comprehensive digital marketing strategies including SEO, social media, and content marketing."
  },
  {
    title: "Project Management Professional",
    category: "Business",
    durationWeeks: 10,
    instructor: "Lisa Thompson",
    students: 450,
    status: "active",
    price: 399,
    description: "Prepare for PMP certification with comprehensive project management methodologies and best practices."
  },
  {
    title: "Machine Learning Basics",
    category: "AI/ML",
    durationWeeks: 12,
    instructor: "Dr. Alex Kumar",
    students: 380,
    status: "active",
    price: 499,
    description: "Introduction to machine learning algorithms, model training, and practical applications."
  },
  {
    title: "Mobile App Development",
    category: "Programming",
    durationWeeks: 8,
    instructor: "David Park",
    students: 560,
    status: "active",
    price: 349,
    description: "Build native and cross-platform mobile applications using React Native and Flutter."
  },
  {
    title: "Cybersecurity Fundamentals",
    category: "Security",
    durationWeeks: 6,
    instructor: "Rachel Green",
    students: 420,
    status: "active",
    price: 279,
    description: "Learn essential cybersecurity concepts, threat analysis, and security best practices."
  },
  {
    title: "Business Analytics",
    category: "Analytics",
    durationWeeks: 7,
    instructor: "Mark Anderson",
    students: 320,
    status: "active",
    price: 249,
    description: "Use data to drive business decisions with statistical analysis and business intelligence tools."
  },
  {
    title: "Cloud Computing with AWS",
    category: "Cloud",
    durationWeeks: 9,
    instructor: "Jennifer Lee",
    students: 680,
    status: "active",
    price: 399,
    description: "Master Amazon Web Services for cloud infrastructure, deployment, and management."
  },
  {
    title: "Graphic Design Mastery",
    category: "Design",
    durationWeeks: 6,
    instructor: "Carlos Mendez",
    students: 580,
    status: "active",
    price: 199,
    description: "Advanced graphic design techniques using Adobe Creative Suite and modern design principles."
  },
  {
    title: "Financial Analysis",
    category: "Finance",
    durationWeeks: 5,
    instructor: "Dr. Patricia Brown",
    students: 290,
    status: "active",
    price: 229,
    description: "Learn financial modeling, valuation techniques, and investment analysis fundamentals."
  }
];

async function seedCourses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aspiro');
    console.log('Connected to MongoDB');

    // Clear existing courses
    await Course.deleteMany({});
    console.log('Cleared existing courses');

    // Insert sample courses
    const insertedCourses = await Course.insertMany(sampleCourses);
    console.log(`Inserted ${insertedCourses.length} sample courses`);

    // Display inserted courses
    console.log('\nInserted courses:');
    insertedCourses.forEach(course => {
      console.log(`- ${course.title} (${course.category}) - $${course.price}`);
    });

  } catch (error) {
    console.error('Error seeding courses:', error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the seeding function
seedCourses();
