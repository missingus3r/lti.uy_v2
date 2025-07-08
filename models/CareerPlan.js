const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    semester: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        required: true
    }
});

const careerPlanSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    subjects: [subjectSchema],
    totalCredits: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate total credits from subjects
careerPlanSchema.methods.calculateTotalCredits = function() {
    this.totalCredits = this.subjects.reduce((sum, subject) => sum + subject.credits, 0);
    return this.totalCredits;
};

// Get subjects by semester
careerPlanSchema.methods.getSubjectsBySemester = function(semester) {
    return this.subjects.filter(subject => subject.semester === semester);
};

// Get all semesters
careerPlanSchema.methods.getSemesters = function() {
    const semesters = [...new Set(this.subjects.map(subject => subject.semester))];
    return semesters.sort((a, b) => a - b);
};

const CareerPlan = mongoose.model('CareerPlan', careerPlanSchema);

module.exports = CareerPlan;