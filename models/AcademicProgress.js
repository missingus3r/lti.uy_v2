const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    convocatoria: {
        type: String,
        default: ''
    },
    grade: {
        type: String,
        default: ''
    },
    passed: {
        type: Boolean,
        default: false,
        set: function(value) {
            if (value === '' || value === null || value === undefined) {
                return false;
            }
            return Boolean(value);
        }
    }
});

const academicProgressSchema = new mongoose.Schema({
    userHash: {
        type: String,
        required: true,
        index: true
    },
    subjects: [subjectSchema],
    totalCredits: {
        type: Number,
        default: 0
    },
    requiredCredits: {
        type: Number,
        default: 360  // Default for LTI career
    },
    careerPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CareerPlan',
        default: null
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Calculate total earned credits
academicProgressSchema.methods.calculateTotalCredits = function() {
    this.totalCredits = this.subjects
        .filter(subject => subject.passed)
        .reduce((sum, subject) => sum + subject.credits, 0);
    return this.totalCredits;
};

// Get remaining credits
academicProgressSchema.methods.getRemainingCredits = function() {
    return this.requiredCredits - this.totalCredits;
};

// Get progress percentage
academicProgressSchema.methods.getProgressPercentage = function() {
    return Math.min((this.totalCredits / this.requiredCredits) * 100, 100);
};

// Get subjects by semester based on selected plan
academicProgressSchema.methods.getSubjectsBySemester = async function() {
    if (!this.careerPlan) return {};
    
    const CareerPlan = mongoose.model('CareerPlan');
    const plan = await CareerPlan.findById(this.careerPlan);
    
    if (!plan) return {};
    
    const subjectsBySemester = {};
    
    plan.subjects.forEach(planSubject => {
        if (!subjectsBySemester[planSubject.semester]) {
            subjectsBySemester[planSubject.semester] = [];
        }
        
        const userSubject = this.subjects.find(s => 
            s.name.toLowerCase().includes(planSubject.name.toLowerCase()) ||
            planSubject.name.toLowerCase().includes(s.name.toLowerCase())
        );
        
        subjectsBySemester[planSubject.semester].push({
            ...planSubject.toObject(),
            userProgress: userSubject || null
        });
    });
    
    return subjectsBySemester;
};

// Get current semester based on completed subjects
academicProgressSchema.methods.getCurrentSemester = async function() {
    if (!this.careerPlan) return 1;
    
    const subjectsBySemester = await this.getSubjectsBySemester();
    
    for (let semester = 1; semester <= 8; semester++) {
        const semesterSubjects = subjectsBySemester[semester] || [];
        const completedInSemester = semesterSubjects.filter(s => 
            s.userProgress && s.userProgress.passed
        ).length;
        
        if (completedInSemester < semesterSubjects.length) {
            return semester;
        }
    }
    
    return 8; // Graduated or final semester
};

// Merge new subjects data with existing data (update grades, add new subjects)
academicProgressSchema.methods.mergeSubjectsData = function(newSubjects) {
    const existingSubjects = this.subjects || [];
    const mergedSubjects = [...existingSubjects];
    
    newSubjects.forEach(newSubject => {
        // Find existing subject by name (case-insensitive)
        const existingIndex = mergedSubjects.findIndex(existing => 
            existing.name.toLowerCase().trim() === newSubject.name.toLowerCase().trim()
        );
        
        if (existingIndex !== -1) {
            // Update existing subject - preserve all fields but update grades and status
            const existing = mergedSubjects[existingIndex];
            
            // Update grade if new data has a grade
            if (newSubject.grade && newSubject.grade.trim() !== '') {
                existing.grade = newSubject.grade;
            }
            
            // Update convocatoria if new data has it
            if (newSubject.convocatoria && newSubject.convocatoria.trim() !== '') {
                existing.convocatoria = newSubject.convocatoria;
            }
            
            // Update passed status based on new grade
            existing.passed = newSubject.passed;
            
            // Update credits if they changed (in case of curriculum updates)
            if (newSubject.credits && newSubject.credits > 0) {
                existing.credits = newSubject.credits;
            }
            
            // Update type if provided
            if (newSubject.type && newSubject.type.trim() !== '') {
                existing.type = newSubject.type;
            }
            
        } else {
            // Add new subject that wasn't in the existing data
            mergedSubjects.push({
                name: newSubject.name,
                credits: newSubject.credits || 0,
                type: newSubject.type || '',
                convocatoria: newSubject.convocatoria || '',
                grade: newSubject.grade || '',
                passed: newSubject.passed || false
            });
        }
    });
    
    // Update the subjects array
    this.subjects = mergedSubjects;
    this.lastUpdated = new Date();
    
    return this;
};

const AcademicProgress = mongoose.model('AcademicProgress', academicProgressSchema);

module.exports = AcademicProgress;